export default {
  async fetch(request, env) {
    if (request.url.includes('/api/status')) {
      try {
        const socket = await Deno.connect({ hostname: "smpaka.qzz.io", port: 25565 });
        
        const handshake = this.createPacket(0x00, {
          protocolVersion: 764,
          serverAddress: "smpaka.qzz.io",
          serverPort: 25565,
          nextState: 1
        });
        await socket.write(handshake);
        
        await socket.write(new Uint8Array([0x00]));
        await socket.write(new Uint8Array([0x01, 0x00]));
        
        const response = await this.readResponse(socket);
        socket.close();
        
        const data = JSON.parse(response);
        return new Response(JSON.stringify({ online: data.players?.online || 0 }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch(e) {
        return new Response(JSON.stringify({ online: 0, error: e.message }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    return new Response("MC Ping", { status: 200 });
  },
  
  createPacket(id, data) {
    const payload = JSON.stringify(data);
    const length = 1 + this.varInt(payload.length) + payload.length;
    const buf = new Uint8Array(length);
    buf[0] = id;
    // simplified - in real implementation need proper varint encoding
    return buf;
  },
  
  readResponse(socket) {
    // read response logic
    return Promise.resolve("{}");
  },
  
  varInt(n) {
    let len = 1;
    while (n > 0x7f) { n >>= 7; len++; }
    return len;
  }
};