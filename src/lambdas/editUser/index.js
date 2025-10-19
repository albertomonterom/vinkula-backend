const bcrypt = require("bcryptjs");
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-2" });

exports.handler = async (event) => {
  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { idUser, name, lastName, email, password, favoriteCategories } = body || {};

    if (!idUser) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing user ID" }) };
    }

    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (name !== undefined) {
      expressionAttributeNames["#name"] = "name";
      updateExpression.push("#name = :name");
      expressionAttributeValues[":name"] = { S: name };
    }
    if (lastName !== undefined) {
      updateExpression.push("lastName = :lastName");
      expressionAttributeValues[":lastName"] = { S: lastName };
    }
    if (email !== undefined) {
      updateExpression.push("email = :email");
      expressionAttributeValues[":email"] = { S: email };
    }

    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateExpression.push("password = :password");
      expressionAttributeValues[":password"] = { S: hashedPassword };
    }

    if (favoriteCategories !== undefined) {
      updateExpression.push("favoriteCategories = :favoriteCategories");
      expressionAttributeValues[":favoriteCategories"] = { L: favoriteCategories.map((c) => ({ S: c })) };
    }

    if (updateExpression.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ message: "No fields to update" }) };
    }

    const commandParams = {
      TableName: "vinkula-users",
      Key: { idUser: { S: idUser } },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      commandParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    const command = new UpdateItemCommand(commandParams);
    const response = await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User updated successfully",
        idUser,
        updatedFields: Object.keys(expressionAttributeValues),
        newValues: response.Attributes || {},
      }),
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error.message,
      }),
    };
  }
};