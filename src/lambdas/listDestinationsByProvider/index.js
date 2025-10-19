const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const dynamo = new DynamoDBClient({ region: "us-east-2" });

exports.handler = async (event) => {
  try {
    const { idProvider } = event.pathParameters;

    if (!idProvider) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing idProvider parameter" }),
      };
    }

    const command = new ScanCommand({
      TableName: "vinkula-destinations",
      FilterExpression: "idProvider = :p",
      ExpressionAttributeValues: {
        ":p": { S: idProvider },
      },
    });

    const result = await dynamo.send(command);

    const destinations = result.Items.map((item) => ({
      idDestination: item.idDestination.S,
      idProvider: item.idProvider.S,
      name: item.name.S,
      description: item.description.S,
      address: item.address.S,
      latitude: parseFloat(item.latitude.N),
      longitude: parseFloat(item.longitude.N),
      imageUrls: item.imageUrls.L.map((i) => i.S),
      categories: item.categories.L.map((c) => c.S),
      createdAt: item.createdAt.S,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(destinations),
    };
  } catch (error) {
    console.error("Error filtering destinations:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};