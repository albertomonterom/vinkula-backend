require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const s3 = new S3Client({ region: "us-east-2" });
const dynamo = new DynamoDBClient({ region: "us-east-2" });
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const { idProvider, name, description, address, latitude, longitude, imagesBase64 } = body;

    // Validate required fields
    if (
      !idProvider ||
      !name ||
      !description ||
      !address ||
      !latitude ||
      !longitude ||
      !imagesBase64?.length
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
      };
    }

    const idDestination = `DEST_${Date.now()}`;
    const imageUrls = [];

    // Upload images to S3
    for (let i = 0; i < imagesBase64.length; i++) {
      let mimeType = "image/jpeg";
      if (imagesBase64[i].startsWith("data:image/png")) mimeType = "image/png";
      if (imagesBase64[i].startsWith("data:image/webp")) mimeType = "image/webp";

      const extension = mimeType.split("/")[1];
      const base64Data = Buffer.from(
        imagesBase64[i].replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );

      const fileName = `destinations/${idDestination}_${i + 1}.${extension}`;

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: base64Data,
        ContentType: mimeType,
      };

      await s3.send(new PutObjectCommand(uploadParams));
      imageUrls.push(`https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/${fileName}`);
    }

    // Store destination in DynamoDB
    const command = new PutItemCommand({
      TableName: "vinkula-destinations",
      Item: {
        idDestination: { S: idDestination },
        idProvider: { S: idProvider },
        name: { S: name },
        description: { S: description },
        address: { S: address },
        latitude: { N: latitude.toString() },
        longitude: { N: longitude.toString() },
        imageUrls: { L: imageUrls.map((url) => ({ S: url })) },
        createdAt: { S: new Date().toISOString() },
      },
    });

    await dynamo.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Destination created successfully",
        idDestination,
        imageUrls,
      }),
    };
  } catch (error) {
    console.error("Error creating destination:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};