require("dotenv").config();

const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const client = new DynamoDBClient({ region: "us-east-2" });
const s3 = new S3Client({ region: "us-east-2" });
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const { idDestination, name, description, address, latitude, longitude, imagesBase64, categories } = body;

    if (!idDestination) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing destination ID" }) };
    }

    // Upload new images to S3 if provided
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

    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    if (name !== undefined) {
      expressionAttributeNames["#name"] = "name"; // 'name' is a reserved word
    }

    if (name !== undefined) {
      updateExpression.push("#name = :name");
      expressionAttributeValues[":name"] = { S: name };
    }
    if (description !== undefined) {
      updateExpression.push("description = :description");
      expressionAttributeValues[":description"] = { S: description };
    }
    if (address !== undefined) {
      updateExpression.push("address = :address");
      expressionAttributeValues[":address"] = { S: address };
    }
    if (latitude !== undefined) {
      updateExpression.push("latitude = :latitude");
      expressionAttributeValues[":latitude"] = { N: latitude.toString() };
    }
    if (longitude !== undefined) {
      updateExpression.push("longitude = :longitude");
      expressionAttributeValues[":longitude"] = { N: longitude.toString() };
    }
    if (imageUrls.length > 0) {
      updateExpression.push("imageUrls = :imageUrls");
      expressionAttributeValues[":imageUrls"] = { L: imageUrls.map((url) => ({ S: url })) };
    }
    if (categories !== undefined) {
      updateExpression.push("categories = :categories");
      expressionAttributeValues[":categories"] = { L: categories.map((c) => ({ S: c })) };
    }

    if (updateExpression.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ message: "No fields to update" }) };
    }

    // Update item in DynamoDB
    const commandParams = {
      TableName: "vinkula-destinations",
      Key: { idDestination: { S: idDestination } },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      commandParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    const command = new UpdateItemCommand(commandParams);

    await client.send(command);

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