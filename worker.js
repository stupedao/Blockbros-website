export default {
  async fetch(request, env) {
    if (request.url.includes('/api/players')) {
      const count = await pingMinecraft('smpaka.qzz.io', 25565);
      return new Response(JSON.stringify({ online: count }));
    }
    return new Response("MC Ping");
  }
};

async function pingMinecraft(host, port) {
  try {
    const conn = await Deno.connect({hostname: host, port: port});
    const handshake = buildPacket(0x00, {protocolVersion: 764, serverAddress: host, serverPort: port, nextState: 1});
    await conn.write(handshake);
    await conn.write(createVarInt(0));
    const lenBuf = new Uint8Array(1);
    await conn.read(lenBuf);
    const len = readVarint(lenBuf)[0];
    const data = new Uint8Array(len);
    await conn.read(data);
    conn.close();
    const json = JSON.parse(new TextDecoder().decode(data.slice(1)));
    return json.players?.online || 0;
  } catch { return 0; }
}

function buildPacket(id, data) {
  const json = new TextEncoder().encode(JSON.stringify(data));
  const len = 1 + varintLen(json.length) + json.length;
  const buf = new Uint8Array(len);
  buf[0] = id;
  writeVarint(buf, 1, json.length);
  buf.set(json, 1 + varintLen(json.length));
  return buf;
}

function createVarInt(n) {
  const b = [];
  while (n > 0x7f) { b.push((n & 0x7f) | 0x80); n >>= 7; }
  b.push(n);
  return Uint8Array.from(b);
}

function varintLen(n) { let l = 1; while (n > 0x7f) { n >>= 7; l++; } return l; }
function writeVarint(buf, off, n) { let i = off; while (n > 0x7f) { buf[i++] = (n & 0x7f) | 0x80; n >>= 7; } buf[i++] = n & 0x7f; return i; }
function readVarint(buf) { let r = 0, s = 0, i = 0; while (true) { const b = buf[i++]; r |= (b & 0x7f) << s; if (!(b & 0x80)) break; s += 7; } return [r, i]; }