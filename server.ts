import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory simple audit logger for backend simulation
  const auditLogs: any[] = [];

  // API Route: Unlock School Application
  app.post("/api/school-applications/:id/unlock", (req, res) => {
    const { id } = req.params;
    const { reason, requestorId, requestorRole } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Razlog za otključavanje mora imati barem 10 znakova.' });
    }

    // RBAC: Verify requestor has permission
    const hasUnlockPermission = ['PRIMARY_HOMEROOM_TEACHER', 'PRIMARY_ADMIN', 'SUPER_ADMIN'].includes(requestorRole);
    if (!hasUnlockPermission) {
      return res.status(403).json({ error: 'Nemate ovlasti za otključavanje ove liste.' });
    }

    // In a real app, here we would check DB:
    // 1. Does app exist?
    // 2. Is it locked?
    // 3. Does the teacher have permission for THIS student?

    auditLogs.push({
      event: 'SCHOOL_WISH_LIST_UNLOCKED',
      applicationId: id,
      requestorId,
      requestorRole,
      reason,
      timestamp: new Date().toISOString()
    });

    console.log(`[AUDIT] SCHOOL_WISH_LIST_UNLOCKED: App ${id} by ${requestorId}. Reason: ${reason}`);

    return res.status(200).json({ 
      success: true, 
      status: 'DRAFT',
      message: 'Lista je uspješno otključana i vraćena u izradu.'
    });
  });

  // API Route: Unlock University Application
  app.post("/api/university-applications/:id/unlock", (req, res) => {
    const { id } = req.params;
    const { reason, requestorId, requestorRole } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Razlog za otključavanje mora imati barem 10 znakova.' });
    }

    // RBAC: Verify requestor has permission
    const hasUnlockPermission = ['SECONDARY_HOMEROOM_TEACHER', 'SECONDARY_ADMIN', 'SUPER_ADMIN'].includes(requestorRole);
    if (!hasUnlockPermission) {
      return res.status(403).json({ error: 'Nemate ovlasti za otključavanje ove liste.' });
    }

    auditLogs.push({
      event: 'UNIVERSITY_PRIORITY_LIST_UNLOCKED',
      applicationId: id,
      requestorId,
      requestorRole,
      reason,
      timestamp: new Date().toISOString()
    });

    console.log(`[AUDIT] UNIVERSITY_PRIORITY_LIST_UNLOCKED: App ${id} by ${requestorId}. Reason: ${reason}`);

    return res.status(200).json({ 
      success: true, 
      status: 'DRAFT',
      message: 'Lista je uspješno otključana i vraćena u izradu.'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
