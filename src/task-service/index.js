const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

// const ddb = DynamoDBDocumentClient.from(
//     new DynamoDBClient({ region: "us-east-1" })
// );

// const sqs = new SQSClient({ region: "us-east-1" });

// const TASKS_TABLE = "Tasks";
// const MEMBERS_TABLE = "WorkspaceMembers";

// const QUEUE_URL =
//     "https://sqs.us-east-1.amazonaws.com/506098131053/TaskeventsQueue";

// const BUCKET = "saas-collab-uploads-unique123";

const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({})
);

const sqs = new SQSClient({});

// Environment Variables
const TASKS_TABLE = process.env.TASKS_TABLE;
const MEMBERS_TABLE = process.env.MEMBERS_TABLE;
const QUEUE_URL = process.env.SQS_QUEUE_URL;
const BUCKET = process.env.UPLOAD_BUCKET;

const ALLOWED_STATUS = ["TODO", "IN_PROGRESS", "DONE"];

exports.handler = async (event) => {
     if (event.requestContext?.http?.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
      },
      body: ""
    };
  }
    try {
        const method =
            event.httpMethod || event.requestContext?.http?.method;

        const userId =
            event.requestContext?.authorizer?.jwt?.claims?.sub;

        if (!userId) {
            return response(401, { message: "Unauthorized" });
        }

        const body = event.body ? JSON.parse(event.body) : {};

        // ---------------- CREATE TASK ----------------
        if (method === "POST") {
            const { title, workspaceId, fileKey } = body;

            if (!workspaceId) {
                return response(400, { message: "workspaceId required" });
            }

            if (!title || !title.trim()) {
                return response(400, { message: "Title required" });
            }

            const membership = await getMembership(workspaceId, userId);

            if (!membership) {
                return response(403, { message: "Forbidden" });
            }

            const task = {
                taskId: Date.now().toString(),
                userId,
                workspaceId,
                title: title.trim(),
                status: "TODO",
                createdAt: new Date().toISOString(),
                fileKey: fileKey || null
            };

            await ddb.send(
                new PutCommand({
                    TableName: TASKS_TABLE,
                    Item: task
                })
            );

            await sendEvent({
                type: "TASK_CREATED",
                taskId: task.taskId,
                workspaceId,
                userId
            });

            return response(200, {
                message: "Task created",
                task
            });
        }

        // ---------------- GET TASKS ----------------
        if (method === "GET") {
            const workspaceId =
                event.queryStringParameters?.workspaceId;

            if (!workspaceId) {
                return response(400, {
                    message: "workspaceId required"
                });
            }

            const membership = await getMembership(
                workspaceId,
                userId
            );

            if (!membership) {
                return response(403, { message: "Forbidden" });
            }

            const result = await ddb.send(
                new QueryCommand({
                    TableName: TASKS_TABLE,
                    IndexName: "workspaceId-index",
                    KeyConditionExpression:
                        "workspaceId = :w",
                    ExpressionAttributeValues: {
                        ":w": workspaceId
                    }
                })
            );

            const sorted = (result.Items || []).sort(
                (a, b) =>
                    new Date(b.createdAt) -
                    new Date(a.createdAt)
            );

            const tasks = sorted.map((task) => ({
                ...task,
                fileUrl: task.fileKey
                    ? `https://${BUCKET}.s3.amazonaws.com/${task.fileKey}`
                    : null
            }));

            return response(200, tasks);
        }

        // ---------------- UPDATE TASK ----------------
        if (method === "PUT") {
            const { taskId, title, status } = body;

            if (!title && !status) {
                return response(400, {
                    message: "Nothing to update"
                });
            }

            if (status && !ALLOWED_STATUS.includes(status)) {
                return response(400, {
                    message: "Invalid status"
                });
            }

            const taskResult = await ddb.send(
                new GetCommand({
                    TableName: TASKS_TABLE,
                    Key: { taskId }
                })
            );

            const task = taskResult.Item;

            if (!task) {
                return response(404, {
                    message: "Task not found"
                });
            }

            const membership = await getMembership(
                task.workspaceId,
                userId
            );

            if (!membership) {
                return response(403, { message: "Forbidden" });
            }

            const isOwner = task.userId === userId;
            const isAdmin = membership.role === "admin";

            if (!isOwner && !isAdmin) {
                return response(403, {
                    message:
                        "Only owner or admin can update task"
                });
            }

            const updates = [];
            const values = {};
            const names = {};

            if (title?.trim()) {
                updates.push("title = :t");
                values[":t"] = title.trim();
            }

            if (status) {
                updates.push("#s = :s");
                values[":s"] = status;
                names["#s"] = "status";
            }

            await ddb.send(
                new UpdateCommand({
                    TableName: TASKS_TABLE,
                    Key: { taskId },
                    UpdateExpression:
                        `SET ${updates.join(", ")}`,
                    ExpressionAttributeValues: values,
                    ExpressionAttributeNames:
                        Object.keys(names).length
                            ? names
                            : undefined
                })
            );

            await sendEvent({
                type: "TASK_UPDATED",
                taskId,
                workspaceId: task.workspaceId,
                userId
            });

            return response(200, {
                message: "Task updated"
            });
        }

        // ---------------- DELETE TASK ----------------
        if (method === "DELETE") {
            const { taskId } = body;

            const taskResult = await ddb.send(
                new GetCommand({
                    TableName: TASKS_TABLE,
                    Key: { taskId }
                })
            );

            const task = taskResult.Item;

            if (!task) {
                return response(404, {
                    message: "Task not found"
                });
            }

            const membership = await getMembership(
                task.workspaceId,
                userId
            );

            if (!membership) {
                return response(403, { message: "Forbidden" });
            }

            const isOwner = task.userId === userId;
            const isAdmin = membership.role === "admin";

            if (!isOwner && !isAdmin) {
                return response(403, {
                    message:
                        "Only owner or admin can delete task"
                });
            }

            await ddb.send(
                new DeleteCommand({
                    TableName: TASKS_TABLE,
                    Key: { taskId }
                })
            );

            await sendEvent({
                type: "TASK_DELETED",
                taskId,
                workspaceId: task.workspaceId,
                userId
            });

            return response(200, {
                message: "Task deleted"
            });
        }

        return response(400, {
            message: "Unsupported method"
        });

    } catch (error) {
        console.error(error);
        return response(500, {
            message: "Server error",
            error: error.message
        });
    }
};

// ---------------- HELPERS ----------------

async function getMembership(workspaceId, userId) {
    const result = await ddb.send(
        new GetCommand({
            TableName: MEMBERS_TABLE,
            Key: { workspaceId, userId }
        })
    );
    return result.Item;
}

async function sendEvent(payload) {
    if (!QUEUE_URL) return;

    await sqs.send(
        new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(payload)
        })
    );
}

function response(statusCode, body) {
    return {
        statusCode,
        headers:{ 
            "Access-Control-Allow-Origin":"*",
            // "Access-Control-Allow-Headers":"*"
             "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"


        },
        body: JSON.stringify(body)
    };
}