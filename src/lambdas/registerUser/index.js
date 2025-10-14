const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const bcrypt = require("bcryptjs");

const client = new DynamoDBClient({ region: "us-east-2" });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { name, lastName, email, password } = body;

    if (!name || !lastName || !email || !password) {
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      idUser: { S: `USR_${Date.now()}` },
      name: { S: name },
      lastName: { S: lastName },
      email: { S: email },
      password: { S: hashedPassword },
      role: { S: "user" },
      createdAt: { S: new Date().toISOString() },
    };

    const command = new PutItemCommand({
      TableName: "vinkula-users",
      Item: user,
    });

    await client.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User registered successfully",
        user: {
          idUser: user.idUser.S,
          name: user.name.S,
          lastName: user.lastName.S,
          email: user.email.S,
          role: user.role.S,
          createdAt: user.createdAt.S,
        },
      }),
    };
  } catch (error) {
    console.error("Error registering user:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error", error: error.message }) };
  }
};