# PayMe Deployment Scripts

Quick reference for all available deployment options.

## Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-menu.sh` | Interactive menu | `./deploy-menu.sh` |
| `build-local.sh` | Build on your machine | `./build-local.sh` |
| `deploy.sh` | Deploy built image to RPi | `./deploy.sh <host> <user>` |
| `deploy-prebuilt.sh` | Download & deploy from registry | `./deploy-prebuilt.sh <tag> <host> <user>` |

## Quick Examples

### 1️⃣ Interactive (Recommended for New Users)
```bash
./deploy-menu.sh
# Choose from menu
```

### 2️⃣ Build & Deploy (Recommended for Developers)
```bash
./build-local.sh                    # Build on powerful machine
./deploy.sh 192.168.1.100 pi        # Deploy to RPi
```

### 3️⃣ Download & Deploy (Fastest)
```bash
./deploy-prebuilt.sh latest 192.168.1.100 pi
```

### 4️⃣ Local Development
```bash
docker compose up -d
# Access at http://localhost:3000
```

## Configuration

### For deploy.sh & deploy-prebuilt.sh

**Defaults:**
- RPi Host: `raspberrypi.local` (set to IP if needed)
- RPi User: `pi` (set to your username)

**Examples:**
```bash
# Static IP
./deploy.sh 192.168.1.50 pi

# Custom hostname
./deploy.sh my-rpi.local pi

# Custom user
./deploy.sh rpi-hostname myusername
```

## SSH Passwordless Setup (One-time)

```bash
ssh-copy-id pi@192.168.1.100
# Enter password once, then all scripts work without prompts
```

## Environment Variables

For `.rpi.yml`, set in `~/.env` or via `-e` flag:
```bash
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://your-domain.com
DB_POOL_SIZE=10
```

## Troubleshooting

**Scripts won't run?**
```bash
chmod +x *.sh
```

**SSH connection errors?**
```bash
ssh-keygen -f ~/.ssh/known_hosts -R 192.168.1.100
ssh pi@192.168.1.100
```

**Docker not found on RPi?**
```bash
ssh pi@192.168.1.100
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## See Also

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Full deployment guide
- [.github/workflows/docker.yml](../.github/workflows/docker.yml) - GitHub Actions CI/CD
