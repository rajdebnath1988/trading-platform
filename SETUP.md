# TradeX Platform — Complete Setup Guide

## Prerequisites (MacBook M1)
```bash
brew install kubectl helm argocd k9s
brew install --cask docker
# Verify
docker --version && kubectl version --client && helm version
```

---

## PHASE 1 — Launch EC2

### Step 1: AWS Console → EC2 → Launch Instance
| Field            | Value                          |
|------------------|--------------------------------|
| Name             | tradex-platform                |
| AMI              | Ubuntu Server 24.04 LTS (x86_64) |
| Instance type    | **t3.medium** (2vCPU, 4GB RAM) |
| Key pair         | Create new → tradex-key.pem    |
| Storage          | 20 GB gp3                      |

### Step 2: Security Group — `tradex-sg`
| Port       | Protocol | Source    | Purpose          |
|------------|----------|-----------|------------------|
| 22         | TCP      | Your IP/32| SSH              |
| 80         | TCP      | 0.0.0.0/0 | HTTP             |
| 443        | TCP      | 0.0.0.0/0 | HTTPS            |
| 6443       | TCP      | Your IP/32| K3s API          |
| 30080      | TCP      | 0.0.0.0/0 | App (NodePort)   |
| 31080      | TCP      | 0.0.0.0/0 | ArgoCD UI        |
| 30000-32767| TCP      | Your IP/32| NodePort range   |

### Step 3: User Data
In **Advanced Details → User Data**, paste the entire contents of `ec2-bootstrap.sh`.

### Step 4: Launch & Wait (~8–10 min)
```bash
# SSH in and watch bootstrap
ssh -i tradex-key.pem ubuntu@YOUR_EC2_IP
tail -f /var/log/tradex-bootstrap.log

# Wait for this line:
# === TradeX Bootstrap COMPLETE! ===

# Verify all system pods are running
kubectl get pods -A
```

---

## PHASE 2 — GitHub Repository

### Step 5: Create public repo & push code
```bash
# On your MacBook
cd /path/to/trading-platform

git init
git add .
git commit -m "feat: initial trading platform commit"

# Create repo at github.com/YOUR_USERNAME/trading-platform (public)
git remote add origin https://github.com/YOUR_USERNAME/trading-platform.git
git branch -M main
git push -u origin main
```

### Step 6: Replace placeholder username everywhere
```bash
# macOS sed requires '' after -i
find . -type f \( -name "*.yaml" -o -name "*.yml" -o -name "*.properties" \) \
  | xargs sed -i '' 's/GITHUB_USERNAME/YOUR_ACTUAL_USERNAME/g'

# Also update sonar-project.properties manually:
# sonar.projectKey=YOUR_USERNAME_trading-platform
# sonar.organization=YOUR_SONARCLOUD_ORG

git add .
git commit -m "ci: set correct GitHub username"
git push
```

### Step 7: Add GitHub Secrets
Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name  | How to get                                                                 |
|--------------|----------------------------------------------------------------------------|
| `SONAR_TOKEN`| sonarcloud.io → My Account → Security → Generate Token                    |
| `GIT_TOKEN`  | GitHub → Settings → Developer Settings → PAT (Classic) → repo scope      |

### Step 8: Setup SonarCloud
1. Go to **sonarcloud.io** → Sign in with GitHub
2. Click **+** → Analyze new project → Import from GitHub → pick `trading-platform`
3. Choose **With GitHub Actions** as analysis method
4. In SonarCloud project settings: turn OFF **Automatic Analysis**
5. Copy the token → add as `SONAR_TOKEN` secret in GitHub (Step 7)

---

## PHASE 3 — Kubernetes Secrets & Deploy

### Step 9: Copy kubeconfig to Mac
```bash
# Run on MacBook
scp -i tradex-key.pem ubuntu@YOUR_EC2_IP:/home/ubuntu/.kube/config \
  ~/.kube/tradex-config

# Fix server address to point to EC2
sed -i '' 's/127.0.0.1/YOUR_EC2_IP/' ~/.kube/tradex-config

export KUBECONFIG=~/.kube/tradex-config
kubectl get nodes        # Should show: trading-node   Ready
```

### Step 10: Create Kubernetes Secrets
```bash
# IMPORTANT: Use strong passwords — these go into the cluster, NOT git
kubectl create namespace trading-platform

kubectl create secret generic app-secrets \
  -n trading-platform \
  --from-literal=DB_USER=trading \
  --from-literal=DB_PASSWORD="TradexProd@2024#Secure" \
  --from-literal=DATABASE_URL="postgresql://trading:TradexProd@2024#Secure@postgresql:5432/tradingdb" \
  --from-literal=JWT_SECRET="TradexJWT2024SecretKeyMustBe32CharsMinimum!"

# Verify secret was created
kubectl get secret app-secrets -n trading-platform
```

---

## PHASE 4 — ArgoCD

### Step 11: Login to ArgoCD
```bash
# Get initial password (also saved in ~/argocd-initial-password.txt on EC2)
ARGOCD_PASS=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)
echo "Password: $ARGOCD_PASS"

# Login via CLI (from Mac or EC2)
argocd login YOUR_EC2_IP:31080 \
  --username admin \
  --password "$ARGOCD_PASS" \
  --insecure

# Change default password immediately
argocd account update-password

# For public repo — no credentials needed
argocd repo add https://github.com/YOUR_USERNAME/trading-platform
```

### Step 12: Deploy ArgoCD Application
```bash
# Apply the application manifest
kubectl apply -f argocd/application.yaml

# Watch sync status
argocd app get trading-platform
argocd app sync trading-platform --force

# Watch pods come up (takes 3–5 min first time)
watch kubectl get pods -n trading-platform
```

### Step 13: Verify Deployment
```bash
EC2_IP=YOUR_EC2_IP

# All pods should be Running
kubectl get pods -n trading-platform

# Check rollouts
kubectl argo rollouts list rollouts -n trading-platform

# Test health endpoints
curl http://$EC2_IP:30080/api/health
curl http://$EC2_IP:30080/api/market/stocks | jq '.[0]'

# Register a test user
curl -X POST http://$EC2_IP:30080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@tradex.com","password":"Demo@1234","fullName":"Demo User"}'

# Login and get token
TOKEN=$(curl -s -X POST http://$EC2_IP:30080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@tradex.com","password":"Demo@1234"}' | jq -r '.token')

# Test authenticated endpoint
curl http://$EC2_IP:30080/api/portfolio \
  -H "Authorization: Bearer $TOKEN" | jq

# Open frontend
open http://$EC2_IP:30080

# Open ArgoCD
open http://$EC2_IP:31080
```

---

## PHASE 5 — Trigger CI/CD Pipeline

### Step 14: Push a change → watch full pipeline
```bash
# Make any change, e.g. bump version in api-gateway health response
# Then push:
git add .
git commit -m "feat: trigger deployment pipeline"
git push origin main

# Pipeline runs in ~8–12 min total:
# 1. GitLeaks scan          (~30s)
# 2. SonarCloud scan        (~2min)
# 3. Build + Trivy x6       (~5min parallel)
# 4. Push images to GHCR    (~1min)
# 5. Update kustomization   (~30s)
# ArgoCD detects git change → auto-syncs cluster (~2min)

# Watch pipeline: github.com/YOUR_USERNAME/trading-platform/actions
# Watch ArgoCD:   http://YOUR_EC2_IP:31080
```

---

## PHASE 6 — Blue-Green Deployment

### Step 15: Test Blue-Green on api-gateway
```bash
# Make a change to api-gateway (e.g. update VERSION in health endpoint)
git commit -am "feat: api-gateway v1.1.0"
git push

# After pipeline pushes new image, watch the rollout
kubectl argo rollouts get rollout api-gateway -n trading-platform --watch

# Status will show:
#   Revision:       2
#   Updated:        2        (green pods)
#   Active:         2        (blue pods still serving)
#   Preview:        2        (green pods — pre-promotion analysis running)

# Open Argo Rollouts dashboard
kubectl argo rollouts dashboard &
open http://localhost:3100

# After pre-promotion analysis passes, promote to 100%
kubectl argo rollouts promote api-gateway -n trading-platform

# If something is wrong — instant rollback
kubectl argo rollouts abort api-gateway -n trading-platform
```

---

## PHASE 7 — Canary Deployment

### Step 16: Test Canary on frontend
```bash
# Push a frontend change
git commit -am "feat: frontend v1.1.0 - new UI updates"
git push

# Watch canary progress
kubectl argo rollouts get rollout frontend -n trading-platform --watch

# Progress: 10% → (2min) → 25% → (2min) → 50% → (1min) → 75% → (1min) → 100%
# Each step runs health check analysis before proceeding

# Manually pause at current step
kubectl argo rollouts pause frontend -n trading-platform

# Resume
kubectl argo rollouts resume frontend -n trading-platform

# Skip all steps — promote immediately
kubectl argo rollouts promote frontend -n trading-platform --full

# Abort and rollback
kubectl argo rollouts abort frontend -n trading-platform
```

---

## PHASE 8 — Monitoring with k9s

### Step 17: Use k9s terminal dashboard
```bash
# SSH into EC2
ssh -i tradex-key.pem ubuntu@YOUR_EC2_IP

# Launch k9s for trading-platform namespace
k9s -n trading-platform

# Key k9s shortcuts:
# :pod      → list pods
# :svc      → list services
# :ing      → list ingresses
# :rollout  → list Argo rollouts (after installing CRD plugin)
# d         → describe resource
# l         → view logs
# s         → shell into pod
# Ctrl+D    → delete resource
# /         → filter
# 0         → all namespaces
```

---

## CLEANUP (after testing)

```bash
# Delete ArgoCD app (removes all K8s resources)
argocd app delete trading-platform --cascade

# Or: delete namespace directly
kubectl delete namespace trading-platform

# TERMINATE the EC2 instance from AWS Console
# (do NOT just stop — stopped instances still incur EBS charges)
# AWS Console → EC2 → Instances → Select → Instance state → Terminate

# Verify no running instances
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name]' \
  --output table
```

---

## Cost Summary

| Resource      | Cost             | 6 hours total |
|---------------|------------------|---------------|
| t3.medium     | $0.0416/hr       | $0.25 (~21₹)  |
| 20GB gp3 EBS  | $0.08/GB/month   | ~$0.003       |
| Data transfer | minimal (testing) | ~$0.00        |
| **Total**     |                  | **~21₹**      |

> Well within your 100₹ budget!
