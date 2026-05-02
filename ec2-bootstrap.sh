#!/bin/bash
# ============================================================
# TradeX Platform — EC2 Bootstrap Script
# Run as EC2 User Data OR manually: sudo bash ec2-bootstrap.sh
# Expected instance: Ubuntu 24.04 LTS, t3.medium
# ============================================================
set -euxo pipefail
exec > >(tee /var/log/tradex-bootstrap.log | logger -t tradex-bootstrap -s 2>/dev/console) 2>&1

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "=== TradeX Bootstrap started at $TIMESTAMP ==="

# ── System update ──────────────────────────────────────────
apt-get update -y
apt-get install -y \
  curl wget git unzip jq \
  apt-transport-https ca-certificates \
  gnupg lsb-release

# ── K3s (lightweight Kubernetes) ──────────────────────────
# Disable built-in traefik/servicelb — we'll use nginx ingress
export INSTALL_K3S_EXEC="server \
  --disable traefik \
  --disable servicelb \
  --write-kubeconfig-mode 644 \
  --node-name trading-node \
  --kubelet-arg=max-pods=110"

curl -sfL https://get.k3s.io | sh -

echo "Waiting for K3s node to be Ready..."
until kubectl get nodes 2>/dev/null | grep -q " Ready"; do sleep 4; done
echo "K3s is Ready!"

# ── kubeconfig for ubuntu user ────────────────────────────
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown ubuntu:ubuntu /home/ubuntu/.kube/config
echo 'export KUBECONFIG=/home/ubuntu/.kube/config' >> /home/ubuntu/.bashrc
echo 'alias k=kubectl'   >> /home/ubuntu/.bashrc
echo 'alias kgp="kubectl get pods -A"' >> /home/ubuntu/.bashrc
echo 'alias kroll="kubectl argo rollouts"' >> /home/ubuntu/.bashrc

# ── Helm ──────────────────────────────────────────────────
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# ── Nginx Ingress Controller ──────────────────────────────
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

echo "Waiting for nginx ingress pod..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Patch ingress to NodePort (K3s has no cloud LB)
kubectl patch svc ingress-nginx-controller -n ingress-nginx -p \
  '{"spec":{"type":"NodePort","ports":[
    {"name":"http",  "port":80, "targetPort":80,  "nodePort":30080,"protocol":"TCP"},
    {"name":"https","port":443,"targetPort":443,"nodePort":30443,"protocol":"TCP"}
  ]}}'

echo "Nginx ingress ready on NodePort 30080 (HTTP) / 30443 (HTTPS)"

# ── ArgoCD ────────────────────────────────────────────────
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.10.5/manifests/install.yaml

echo "Waiting for ArgoCD server deployment..."
kubectl wait --for=condition=available --timeout=300s \
  deployment/argocd-server -n argocd

# Patch ArgoCD to NodePort for external UI access
kubectl patch svc argocd-server -n argocd -p \
  '{"spec":{"type":"NodePort","ports":[
    {"name":"http", "port":80,  "targetPort":8080,"nodePort":31080,"protocol":"TCP"},
    {"name":"https","port":443,"targetPort":8080,"nodePort":31443,"protocol":"TCP"}
  ]}}'

# Install ArgoCD CLI
curl -sSL -o /usr/local/bin/argocd \
  https://github.com/argoproj/argo-cd/releases/download/v2.10.5/argocd-linux-amd64
chmod +x /usr/local/bin/argocd

# ── Argo Rollouts ─────────────────────────────────────────
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

echo "Waiting for Argo Rollouts..."
kubectl wait --for=condition=available --timeout=300s \
  deployment/argo-rollouts -n argo-rollouts

# kubectl plugin for Argo Rollouts
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64
mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts

# ── k9s (terminal Kubernetes UI) ─────────────────────────
K9S_VERSION="v0.32.4"
curl -sL https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_amd64.tar.gz \
  | tar xz -C /usr/local/bin k9s

# ── Get ArgoCD admin password ─────────────────────────────
ARGOCD_PASS=$(kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d)

PUBLIC_IP=$(curl -s --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "============================================================"
echo "  TradeX Bootstrap COMPLETE!"
echo "============================================================"
echo "  EC2 Public IP   : ${PUBLIC_IP}"
echo ""
echo "  ArgoCD UI       : http://${PUBLIC_IP}:31080"
echo "  ArgoCD user     : admin"
echo "  ArgoCD password : ${ARGOCD_PASS}"
echo ""
echo "  App (after deploy): http://${PUBLIC_IP}:30080"
echo ""
echo "  Next steps:"
echo "  1. SSH: ssh -i your-key.pem ubuntu@${PUBLIC_IP}"
echo "  2. kubectl get nodes"
echo "  3. Follow SETUP.md"
echo "============================================================"

echo "${ARGOCD_PASS}" > /home/ubuntu/argocd-initial-password.txt
chown ubuntu:ubuntu /home/ubuntu/argocd-initial-password.txt
echo "Bootstrap done" > /home/ubuntu/bootstrap_complete.txt
