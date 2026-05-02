# TradeX — Production-Grade Trading Platform

A full-stack, cloud-native trading platform built for learning DevOps end-to-end.

## Stack
- **Frontend**: React 18 + Vite + Tailwind + Recharts
- **API Gateway**: Node.js + Express (Blue-Green deployment)
- **Auth Service**: Node.js + JWT + bcryptjs
- **Market Data**: Python FastAPI + WebSocket
- **Order Service**: Node.js + PostgreSQL
- **Portfolio Service**: Node.js + PostgreSQL
- **Database**: PostgreSQL 15 (StatefulSet)
- **Orchestration**: Kubernetes (K3s on EC2)
- **GitOps**: ArgoCD with automated sync
- **Deployments**: Argo Rollouts (Blue-Green + Canary)
- **CI/CD**: GitHub Actions (managed runners — free)
- **Security**: GitLeaks + SonarCloud + Trivy + OWASP ZAP

## Quick Start
See [SETUP.md](./SETUP.md) for complete step-by-step instructions.

## Architecture
```
Internet → EC2 (NodePort 30080) → Nginx Ingress → api-gateway (Blue-Green)
                                                → frontend    (Canary)
                                                → market-data (WebSocket)
```

## Security Pipeline
```
git push → GitLeaks → SonarCloud → Build → Trivy → GHCR → Update Manifests
                                                           → ArgoCD sync
```

## Cost
~21 INR for a 6-hour session on t3.medium. **Always terminate after use.**
