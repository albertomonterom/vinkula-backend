const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const dynamo = new DynamoDBClient({ region: "us-east-2" });

exports.handler = async () => {
  try {
    const data = await dynamo.send(new ScanCommand({ TableName: "vinkula-categories" }));
    const categories = (data.Items || []).map(item => ({
      idCategory: item.idCategory.S,
      name: item.name.S,
    }));
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(categories) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal error", error: err.message }) };
  }
};