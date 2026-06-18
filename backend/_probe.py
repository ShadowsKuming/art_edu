import socket, struct, time

host = "dpg-d8c5sael51nc73dkv4lg-a.oregon-postgres.render.com"
port = 5432
s = socket.create_connection((host, port), timeout=15)
print("TCP connected")
# PostgreSQL SSLRequest: int32 length=8, int32 code=80877103
s.sendall(struct.pack("!ii", 8, 80877103))
print("SSLRequest sent; waiting up to 60s for the 1-byte S/N reply...")
s.settimeout(60)
t = time.time()
try:
    b = s.recv(1)
    print("GOT byte:", b, "after", round(time.time() - t, 1), "s")
except Exception as e:
    print("NO RESPONSE after", round(time.time() - t, 1), "s ->", type(e).__name__, e)
s.close()
