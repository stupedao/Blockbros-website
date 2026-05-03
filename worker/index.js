export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === "/api/players") {
      const host = env.MC_HOST;
      const port = parseInt(env.MC_PORT) || 25565;
      
      if (!host) {
        return new Response(JSON.stringify({ error: "Server not configured" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const count = await pingServer(host, port);
        return new Response(JSON.stringify({ online: count }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ online: 0, error: e.message }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("MC Ping Worker", { status: 200 });
  }
};

async function pingServer(host, port) {
  const address = { hostname: host, port: port };
  let socket;

  try {
    socket = await Deno.connect(address);
    
    const handshake = createHandshake(host, port);
    await socket.write(handshake);
    
    const statusReq = createVarint(0);
    await socket.write(statusReq);
    
    const lenBuf = new Uint8Array(1);
    await socket.read(lenBuf);
    const len = readVarint(lenBuf)[0];
    
    const data = new Uint8Array(len);
    let read = 0;
    while (read < len) {
      const n = await socket.read(data.slice(read));
      if (!n) break;
      read += n;
    }

    const json = new TextDecoder().decode(data.slice(1));
    const parsed = JSON.parse(json);
    return parsed.players?.online || 0;
  } finally {
    socket?.close();
  }
}

function createHandshake(host, port) {
  const pkt = Buffer.alloc(1 + varintLen(764) + 1 + Buffer.byteLength(host) + 2 + 1);
  let off = 0;
  pkt[off++] = 0x00;
  off = writeVarint(pkt, off, 764);
  pkt[off++] = Buffer.byteLength(host);
  off += Buffer.from(host).copy(pkt, off);
  pkt[off++] = (port >> 8) & 0xff;
  pkt[off++] = port & 0xff;
  pkt[off++] = 1;
  return createVarint(pkt.length).concat(pkt);
}

function createVarint(n) {
  const buf = [];
  while (true) {
    let b = n & 0x7f;
    n >>= 7;
    if (n === 0) { buf.push(b); break; }
    buf.push(b | 0x80);
  }
  return Buffer.from(buf);
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