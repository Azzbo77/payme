# Deployment Guide for PayMe

## 🎯 Interactive Menu (Easiest)

```bash
./deploy-menu.sh
```

This gives you options:
1. **Build Locally & Deploy** - Full workflow on one command
2. **Build Locally Only** - Just build, deploy later
3. **Download Pre-built Image** - Use image from registry (fastest)
4. **Local Development** - Start services locally
5. Exit

---

## Quick Start (Manual - Recommended for RPi)

### On Your Powerful Computer:
```bash
# Build everything
./build-local.sh

# Deploy to RPi
./deploy.sh 192.168.1.100 pi
```

Replace:
- `192.168.1.100` with your RPi's IP address or hostname
- `pi` with your RPi username (usually `pi`)

---

## 📥 Download Pre-built Images

**Best for:** Contributing developers or users who just want to deploy

Go to [GitHub Releases](../../releases) and download:
- `deploy-prebuilt.sh` - Download and deploy script
- `docker-compose.rpi.yml` - RPi configuration

Then:
```bash
chmod +x deploy-prebuilt.sh
./deploy-prebuilt.sh latest 192.168.1.100 pi
```

Builds are automatically pushed to `ghcr.io/azzbo77/payme` on every commit.

---

## 🏗️ Manual Deployment Steps (Advanced)

If you prefer more control:

### On Your Computer:
```bash
# Build
docker build -t payme:latest .

# Save image
docker save payme:latest | gzip > payme.tar.gz

# Transfer (one-time SSH setup needed)
scp payme.tar.gz pi@192.168.1.100:/tmp/
```

### On Raspberry Pi:
```bash
# Load image
docker load < /tmp/payme-image.tar.gz

# Clean up
rm /tmp/payme-image.tar.gz

# Start with the RPi-specific compose file
cd ~/payme
docker compose -f docker-compose.rpi.yml up -d
```

---

## Performance Comparison

| Method | Time | Notes |
|--------|------|-------|
| **Docker build on RPi** | 60-120 min | ❌ Very slow |
| **Build on powerful PC + deploy** | 5-10 min | ✅ Recommended |
| **Pre-built images** | <1 min | ✅ Fastest |

---

## SSH Setup (One-time)

If SSH password prompts are annoying, set up key-based auth:

```bash
# On your computer
ssh-copy-id pi@192.168.1.100

# Enter RPi password once, then no more prompts
```

---

## Troubleshooting

**Q: Deploy script fails at SSH?**
- Ensure RPi is reachable: `ping 192.168.1.100`
- Check SSH access: `ssh pi@192.168.1.100 "echo OK"`

**Q: Image transfer is slow?**
- Normal for large Docker images over network
- Consider wired Ethernet if possible

**Q: Docker compose up on RPi takes forever?**
- Make sure you're using `docker-compose.rpi.yml` (no build step)
- Check: `docker images | grep payme`

---

## 📊 Deployment Options Comparison

| Method | Time | Effort | Best For |
|--------|------|--------|----------|
| **Interactive Menu** | Varies | Minimal | First-time users |
| **Build Locally + Deploy** | 5-10 min | Low | Regular deployments |
| **Pre-built Download** | <1 min | Minimal | Quick testing |
| **Local Development** | 5 min | Low | Feature development |
| **Docker build on RPi** | 60-120 min | None | ❌ Avoid |

---

## 📝 Notes

- `.rpi.yml` uses the pre-built image (fast)
- Original `docker-compose.yml` still works everywhere for local dev
- Scripts are idempotent (safe to run multiple times)
- GitHub Actions builds for both `amd64` and `arm64` automatically
