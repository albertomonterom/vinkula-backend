require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const jwt = require("jsonwebtoken");

const s3 = new S3Client({ region: "us-east-2" });
const dynamo = new DynamoDBClient({ region: "us-east-2" });
const SECRET_KEY = process.env.SECRET_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
  try {
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Missing token" }),
      };
    }

    // Verify JWT: provider
    const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
    if (decoded.role !== "user") {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Forbidden: only providers can create destinations" }),
      };
    }

    // Parse body
    const body = JSON.parse(event.body);
    const { name, description, address, latitude, longitude, imagesBase64 } = body;

    if (!name || !description || !address || !latitude || !longitude || !imagesBase64?.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
      };
    }

    const idDestination = `DEST_${Date.now()}`;
    const imageUrls = [];

    // Upload each image to S3
    for (let i = 0; i < imagesBase64.length; i++) {
        // Default to jpeg
        let mimeType = "image/jpeg";
        if (imagesBase64[i].startsWith("data:image/png")) mimeType = "image/png";
        if (imagesBase64[i].startsWith("data:image/webp")) mimeType = "image/webp";

        const extension = mimeType.split("/")[1]; // Get file extension from MIME type
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

    // Save destination in DynamoDB
    const command = new PutItemCommand({
      TableName: "vinkula-destinations",
      Item: {
        idDestination: { S: idDestination },
        idProvider: { S: decoded.idUser },
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
