const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// const s3 = new S3Client({ region: "us-east-1" });

// const BUCKET = "saas-collab-uploads-unique123";
const s3 = new S3Client({});

// Environment Variables
const BUCKET = process.env.UPLOAD_BUCKET;

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

        const userId =
            event.requestContext?.authorizer?.jwt?.claims?.sub;

        if (!userId) {
            return response(401, { message: "Unauthorized" });
        }

        const body = JSON.parse(event.body || "{}");

        const { fileName, fileType } = body;

        if (!fileName || !fileType) {
            return response(400, {
                message: "fileName and fileType required"
            });
        }

        //ADD THIS Here
        if(!fileType.startsWith("image/")){
            return response(400, {
                message:"Only image uploads allowed"
            });
        }

        const key = `${userId}/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: fileType
        });

        const uploadUrl = await getSignedUrl(s3, command, {
            expiresIn: 300 // 5 minutes
        });

        return response(200, {
            uploadUrl,
            key
        });

    } catch (error) {
        console.error(error);
        return response(500, { message: "Server error" });
    }
};

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