require("dotenv").config();

const { DynamoDBClient, GetItemCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const jwt = require("jsonwebtoken");
const client = new DynamoDBClient({ region: "us-east-2" });
const bcrypt = require("bcryptjs");
const SECRET_KEY = process.env.SECRET_KEY;
console.log("Using SECRET_KEY:", SECRET_KEY)
exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { email, password } = body;

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing email or password" }),
      };
    }

    // Search user in DynamoDB
    const scanCommand = new ScanCommand({
      TableName: "vinkula-users",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": { S: email },
      },
    });

    const data = await client.send(scanCommand);

    if (data.Items.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    // Get user data
    const user = data.Items[0];
    const storedPassword = user.password.S;

    // Verify password
    const isMatch = await bcrypt.compare(password, storedPassword);
    if (!isMatch) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: "Incorrect password" }),
        };
    }

    // Generate JWT
    const token = jwt.sign(
      {
        idUser: user.idUser.S,
        email: user.email.S,
        role: user.role.S,
      },
      SECRET_KEY,
      { expiresIn: "2h" }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Login successful",
        token,
        user: {
          idUser: user.idUser.S,
          name: user.name.S,
          lastName: user.lastName.S,
          email: user.email.S,
          role: user.role.S,
        },
      }),
    };
  } catch (error) {
    console.error("Error during login:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error", error: error.message }),
    };
  }
};