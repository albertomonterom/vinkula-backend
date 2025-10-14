require("dotenv").config();

const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const jwt = require("jsonwebtoken");

const client = new DynamoDBClient({ region: "us-east-2" });
const s3 = new S3Client({ region: "us-east-2" });
const SECRET_KEY = process.env.SECRET_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
  try {
    // Verify JWT
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ message: "Missing Authorization header" }) };
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);

    // Check provider role
    if (decoded.role !== "user") {
      return { statusCode: 403, body: JSON.stringify({ message: "Forbidden: only providers can edit destinations" }) };
    }

    // Parse request body
    const body = JSON.parse(event.body);
    const { idDestination, name, description, address, latitude, longitude, imagesBase64 } = body;

    if (!idDestination) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing destination ID" }) };
    }

    // Upload new images to S3
    let imageUrls = [];
    if (imagesBase64 && imagesBase64.length > 0) {
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

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: base64Data,
            ContentType: mimeType,
          })
        );

        imageUrls.push(`https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/${fileName}`);
      }
    }

    // Build DynamoDB update expression
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = { "#name": "name" }; // 'name' is reserved

    if (name) {
      updateExpression.push("#name = :name");
      expressionAttributeValues[":name"] = { S: name };
    }
    if (description) {
      updateExpression.push("description = :description");
      expressionAttributeValues[":description"] = { S: description };
    }
    if (address) {
      updateExpression.push("address = :address");
      expressionAttributeValues[":address"] = { S: address };
    }
    if (latitude) {
      updateExpression.push("latitude = :latitude");
      expressionAttributeValues[":latitude"] = { N: latitude.toString() };
    }
    if (longitude) {
      updateExpression.push("longitude = :longitude");
      expressionAttributeValues[":longitude"] = { N: longitude.toString() };
    }
    if (imageUrls.length > 0) {
      updateExpression.push("imageUrls = :imageUrls");
      expressionAttributeValues[":imageUrls"] = { L: imageUrls.map((url) => ({ S: url })) };
    }

    if (updateExpression.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ message: "No fields to update" }) };
    }

    // Update in DynamoDB
    const command = new UpdateItemCommand({
      TableName: "vinkula-destinations",
      Key: { idDestination: { S: idDestination } },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    });

    await client.send(command);

    // Success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Destination updated successfully",
        idDestination,
        updatedFields: Object.keys(expressionAttributeValues),
      }),
    };
  } catch (error) {
    console.error("Error updating destination:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};
