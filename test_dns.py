import socket

hostname = "db.bdxqpzcpetypexnuqexh.supabase.co"
print(f"Resolving {hostname}...")

try:
    # Try to get all addresses
    infos = socket.getaddrinfo(hostname, 5432)
    for info in infos:
        family, socktype, proto, canonname, sockaddr = info
        print(f"Family: {family}, Address: {sockaddr}")
except Exception as e:
    print(f"Error: {e}")
