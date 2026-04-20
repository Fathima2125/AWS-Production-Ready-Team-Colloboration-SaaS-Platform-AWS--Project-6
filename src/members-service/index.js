const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand
} = require("@aws-sdk/lib-dynamodb");

// Environment Variables
// const REGION = process.env.AWS_REGION;
const MEMBERS_TABLE = process.env.MEMBERS_TABLE;

//const client = new DynamoDBClient({ region: REGION });
const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

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

    const body = JSON.parse(event.body || "{}");

    const { workspaceId, newUserId, role } = body;

    // ---------------- ADD MEMBER ----------------
    if (method === "POST") {
      const adminCheck = await ddb.send(
        new GetCommand({
          TableName: MEMBERS_TABLE,
          Key: {
            workspaceId,
            userId
          }
        })
      );

      if (!adminCheck.Item || adminCheck.Item.role !== "admin") {
        return response(403, {
          message: "Only admin can add members"
        });
      }

      await ddb.send(
        new PutCommand({
          TableName: MEMBERS_TABLE,
          Item: {
            workspaceId,
            userId: newUserId,
            role: role || "member"
          }
        })
      );

      return response(200, {
        message: "Member added"
      });
    }

    // ---------------- GET MEMBERS ----------------
    if (method === "GET") {
      const result = await ddb.send(
        new QueryCommand({
          TableName: MEMBERS_TABLE,
          KeyConditionExpression: "workspaceId = :w",
          ExpressionAttributeValues: {
            ":w": workspaceId
          }
        })
      );

      return response(200, result.Items);
    }

    // ---------------- DELETE MEMBER ----------------
    if (method === "DELETE") {
      const adminCheck = await ddb.send(
        new GetCommand({
          TableName: MEMBERS_TABLE,
          Key: {
            workspaceId,
            userId
          }
        })
      );

      if (!adminCheck.Item || adminCheck.Item.role !== "admin") {
        return response(403, {
          message: "Only admin can remove members"
        });
      }

      await ddb.send(
        new DeleteCommand({
          TableName: MEMBERS_TABLE,
          Key: {
            workspaceId,
            userId: newUserId
          }
        })
      );

      return response(200, {
        message: "Member removed"
      });
    }

    return response(400, {
      message: "Unsupported method"
    });

  } catch (error) {
    console.error(error);

    return response(500, {
      message: "Server error"
    });
  }
};

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