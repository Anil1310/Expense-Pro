# Expense Pro - Development & Deployment Guidelines

## Permanent Project Settings
- **Project Name**: `expensepro`
- **GitHub Repository**: `git@github.com:Anil1310/Expense-Pro.git` (Branch: `main`)
- **Primary Production Domain**: `https://expenselive.vercel.app/`
- **Vercel Project**: `expensepro` (Org ID: `team_Yjo2eLAHEvAh9bIyKXrDkbC1`, Project ID: `prj_7ZQY0kVzBMOUuqqoGZJinJ2fIKEo`)

---

## Dynamic Deployment Workflow
Whenever the user makes changes and requests to save, update, upload, or deploy:
1. **Build**: Run `npm run build` to assemble `index.html` and compile from `Expense Tracker/` files.
2. **Commit & Push**:
   ```bash
   git add -A
   git commit -m "<Clear, descriptive commit message>"
   git push origin main
   ```
3. **Deploy to Vercel**:
   - The repository is connected to Vercel, so every push to `origin/main` automatically triggers a production deployment.
   - For immediate CLI deployment, run `npx vercel --prod --yes`.
4. **Domain Invariance**:
   - ALWAYS preserve and use `https://expenselive.vercel.app/`.
   - Never change or overwrite the domain settings.
