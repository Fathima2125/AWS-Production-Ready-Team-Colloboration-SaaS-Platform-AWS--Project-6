const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

//const sns = new SNSClient({ region: "us-east-1" });

// const TOPIC_ARN = "arn:aws:sns:us-east-1:506098131053:TaskNotifications";
// Environment Variables
const TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// AWS automatically picks region in Lambda (no need to hardcode)
const sns = new SNSClient({});

exports.handler = async (event) => {
    console.log("🚀 Consumer Lambda triggered");
    console.log("EVENT RECEIVED:", JSON.stringify(event, null, 2));

    try {

        for (const record of event.Records) {

            console.log("📩 RAW SQS RECORD:", JSON.stringify(record));

            const message = JSON.parse(record.body);

            console.log("📨 PARSED MESSAGE:", message);

            let text = "";

            if (message.type === "TASK_CREATED") {
                text = `New Task Created: ${message.taskId}`;
            } 
            else if (message.type === "TASK_UPDATED") {
                text = `Task Updated: ${message.taskId}`;
            } 
            else if (message.type === "TASK_DELETED") {
                text = `Task Deleted: ${message.taskId}`;
            } 
            else {
                console.log("⚠️ Unknown event type:", message.type);
                continue;
            }

            console.log("📢 SNS MESSAGE TO SEND:", text);

            const result = await sns.send(new PublishCommand({
                TopicArn: TOPIC_ARN,
                Subject: "Task Notification",
                Message: text
            }));

            console.log("✅ SNS RESPONSE:", JSON.stringify(result));
        }

        console.log("🎉 All messages processed successfully");

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Notifications sent successfully"
            })
        };

    } catch (error) {
        console.error("❌ Consumer Lambda ERROR:", error);
        throw error;
    }
};