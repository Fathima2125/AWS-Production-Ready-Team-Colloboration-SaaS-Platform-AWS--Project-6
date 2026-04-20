
import { useEffect, useState } from "react";
import { api } from "../api/api";

const Dashboard = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [workspaceName, setWorkspaceName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    const res = await api.get("/workspace");
    setWorkspaces(res.data);
  };

  const logout = () => {
      localStorage.removeItem("token");
      window.location.href = "/login";
  };

  const createWorkspace = async () => {
    if (!workspaceName.trim()) return;

    await api.post("/workspace", { name: workspaceName });
    setWorkspaceName("");
    fetchWorkspaces();
  };

  const fetchTasks = async (workspaceId) => {
    const res = await api.get(`/tasks?workspaceId=${workspaceId}`);
    setTasks(res.data);
    setSelectedWorkspace(workspaceId);
  };

  const createTask = async () => {
    if (!taskTitle.trim()) return;

    let fileKey = null;

    if (selectedFile) {
      const uploadRes = await api.post("/upload-url", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
      });

      const { uploadUrl, key } = uploadRes.data;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      fileKey = key;
    }

    await api.post("/tasks", {
      title: taskTitle,
      workspaceId: selectedWorkspace,
      fileKey,
    });

    setTaskTitle("");
    setSelectedFile(null);

    fetchTasks(selectedWorkspace);
  };

  const updateTask = async (taskId, status) => {
    await api.put("/tasks", { taskId, status });
    fetchTasks(selectedWorkspace);
  };

  const deleteTask = async (taskId) => {
    await api.delete("/tasks", {
      data: { taskId },
    });

    fetchTasks(selectedWorkspace);
  };

  const openAttachment = async (fileKey) => {
    try {
      const res = await api.get(
        `/download-url?key=${encodeURIComponent(fileKey)}`
      );

      window.open(res.data.downloadUrl, "_blank");
    } catch (err) {
      console.error("Failed to open attachment:", err);
    }
  };

  const getStatusClass = (status) => {
    if (status === "TODO") return "status todo";
    if (status === "IN_PROGRESS") return "status progress";
    return "status done";
  };

  return (
    <div className="container">

      {/* SIDEBAR */}
      <div className="sidebar">
        <h2>🚀 SaaS Tasks</h2>

        <input
          placeholder="New workspace"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
        />

        <button onClick={createWorkspace} style={{ marginTop: 10 }}>
          + Create
        </button>

        <h3 style={{ marginTop: 20 }}>Workspaces</h3>

        {workspaces.map((w) => (
          <div
            key={w.workspaceId}
            className="workspace-item"
            onClick={() => fetchTasks(w.workspaceId)}
          >
            {w.name}
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <h2>Tasks</h2>
          <button onClick={logout}>
                Logout
          </button>
        </div>

        {selectedWorkspace && (
          <div className="card" style={{ marginBottom: 20 }}>
            <input
              placeholder="Task title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />

            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              style={{ marginLeft: 10 }}
            />

            <button onClick={createTask} style={{ marginLeft: 10 }}>
              Add Task
            </button>
          </div>
        )}

        {tasks.map((task) => (
          <div key={task.taskId} className="task-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <h3>{task.title}</h3>

              <span className={getStatusClass(task.status)}>
                {task.status}
              </span>
            </div>

            <select
              value={task.status}
              onChange={(e) =>
                updateTask(task.taskId, e.target.value)
              }
            >
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DONE">DONE</option>
            </select>

            <button
              onClick={() => deleteTask(task.taskId)}
              style={{ marginLeft: 10 }}
            >
              Delete
            </button>

            {task.fileKey && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => openAttachment(task.fileKey)}
                >
                  📎 View Attachment
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;

