export default {
  async fetch(request, env) {
    if (request.url.includes('/api/players')) {
      const count = await pingMinecraft('smpaka.qzz.io', 25565);
      return new Response(JSON.stringify({ online: count }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("MC Worker", { status: 200 });
  }
};

async function pingMinecraft(host, port) {
  try {
    const addr = { hostname: host, port: port };
    const conn = await Deno.connect(addr);
    
    const handshake = buildPacket(0x00, {
      protocolVersion: 764,
      serverAddress: host,
      serverPort: port,
      nextState: 1
    });
    await conn.write(handshake);
    
    await conn.write(new Uint8Array([0x00]));
    
    const lenBuf = new Uint8Array(1);
    await conn.read(lenBuf);
    const len = readVarint(lenBuf)[0];
    
    const data = new Uint8Array(len);
    await conn.read(data);
    conn.close();
    
    const json = JSON.parse(new TextDecoder().decode(data.slice(1)));
    return json.players?.online || 0;
  } catch(e) {
    return 0;
  }
}

function buildPacket(id, data) {
  const json = JSON.stringify(data);
  const jsonBytes = new TextEncoder().encode(json);
  const len = 1 + varintLen(json.length) + jsonBytes.length;
  const buf = new Uint8Array(len);
  buf[0] = id;
  writeVarint(buf, 1, json.length);
  jsonBytes.copyWithin(buf, 1 + varintLen(json.length));
  return buf;
}

function varintLen(n) {
  let len = 1;
  while (n > 0x7f) { n >>= 7; len++; }
  return len;
}

function writeVarint(buf, offset, n) {
  let i = offset;
  while (n > 0x7f) {
    buf[i++] = (n & 0x7f) | 0x80;
    n >>= 7;
  }
  buf[i++] = n & 0x7f;
  return i;
}

function readVarint(buf) {
  let result = 0, shift = 0, i = 0;
  while (true) {
    const b = buf[i++];
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result, i];
}