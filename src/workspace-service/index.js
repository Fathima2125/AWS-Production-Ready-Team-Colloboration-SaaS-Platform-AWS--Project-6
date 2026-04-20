const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    PutCommand,
    QueryCommand,
    GetCommand,
    DeleteCommand
} = require("@aws-sdk/lib-dynamodb");

// const client = new DynamoDBClient({ region: "us-east-1" });
// const ddb = DynamoDBDocumentClient.from(client);

// const TABLE = "Workspace";
// const MEMBERS_TABLE = "WorkspaceMembers";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

// Environment Variables
const TABLE = process.env.WORKSPACE_TABLE;
const MEMBERS_TABLE = process.env.MEMBERS_TABLE;

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
            event.requestContext?.http?.method ||
            event.httpMethod;

        const userId =
            event.requestContext?.authorizer?.jwt?.claims?.sub;

        if (!userId) {
            return response(401, { message: "Unauthorized" });
        }

        // ---------------- CREATE WORKSPACE ----------------
        if (method === "POST") {
            const body = JSON.parse(event.body || "{}");

            const workspaceId = Date.now().toString();

            await ddb.send(new PutCommand({
                TableName: TABLE,
                Item: {
                    workspaceId,
                    name: body.name,
                    createdBy: userId,
                    createdAt: new Date().toISOString()
                }
            }));

            await ddb.send(new PutCommand({
                TableName: MEMBERS_TABLE,
                Item: {
                    workspaceId,
                    userId,
                    role: "admin"
                }
            }));

            return response(200, {
                message: "Workspace created",
                workspaceId
            });
        }

        // ---------------- GET WORKSPACES ----------------
        if (method === "GET") {

            const memberships = await ddb.send(new QueryCommand({
                TableName: MEMBERS_TABLE,
                IndexName: "userId-index",
                KeyConditionExpression: "userId = :u",
                ExpressionAttributeValues: {
                    ":u": userId
                }
            }));

            const results = [];

            for (const membership of memberships.Items || []) {

                const workspace = await ddb.send(new GetCommand({
                    TableName: TABLE,
                    Key: {
                        workspaceId: membership.workspaceId
                    }
                }));

                if (workspace.Item) {
                    results.push({
                        workspaceId: membership.workspaceId,
                        name: workspace.Item.name,
                        role: membership.role
                    });
                }
            }

            return response(200, results);
        }

        // ---------------- DELETE WORKSPACE ----------------
        if (method === "DELETE") {
            const body = JSON.parse(event.body || "{}");
            const { workspaceId } = body;

            if (!workspaceId) {
                return response(400, { message: "workspaceId required" });
            }

            const membership = await getMembership(workspaceId, userId);

            if (!membership || membership.role !== "admin") {
                return response(403, { message: "Only admin can delete workspace" });
            }

            await ddb.send(new DeleteCommand({
                TableName: TABLE,
                Key: { workspaceId }
            }));

            return response(200, {
                message: "Workspace deleted"
            });
        }

        return response(400, { message: "Unsupported method" });

    } catch (error) {
        console.error(error);
        return response(500, { message: "Server error" });
    }
};

// helper (you were missing this but GET uses it logically)
async function getMembership(workspaceId, userId) {
    const result = await ddb.send(new GetCommand({
        TableName: MEMBERS_TABLE,
        Key: { workspaceId, userId }
    }));
    return result.Item;
}

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            // "Access-Control-Allow-Headers": "*"
             "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        body: JSON.stringify(body)
    };
}