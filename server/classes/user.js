const mongo = require("../utils/mongodb.js");
const fs = require("fs");
const results = require("../utils/results");
//todo: create easy get function that returns everything but the statistics objects;
// OR
// add excepted fields to functions
// todo: use users db only for public info!!!!!!!!!!!!!!!!!!!!!!
module.exports = {
  create: async function (username, nickname, email, password) {
    const usersCollection = await mongo.connectWithUsersCollection();

    const _id = await mongo.getIDForNewEntry("users");

    const user = {
      username,
      nickname,
      email,
      password,
      _id: _id,
      confirmed: false,
      key: generateUserKey(),
    };
    //todo: check if user exists
    if (await usersCollection.insertOne(user)) {
      return results.successWithData(user);
    } else return results.error("Unexpected error", 500);
  },
  isExists: async function (query) {
    const usersCollection = await mongo.connectWithUsersCollection();

    if (await usersCollection.findOne(query)) {
      console.log(
        `[User] with ${query?.email} ${query?.nickname} parameters exists`
      );
      return true;
    }
    return false;
  },
  findLoginCredientials: async function (query) {
    console.log(`[User] searching ${query} credientials`);

    const usersCollection = await mongo.connectWithUsersCollection();

    const user = await usersCollection.findOne({
      $or: [{ nickname: query }, { email: query }],
    });

    console.log(`[User] ${query} credientials:` + JSON.stringify(user));

    if (!user) {
      return false;
    }
    return { id: user._id, password: user.password, key: user.key };
  },
  getUserWithKey: async function (key) {
    const usersCollection = await mongo.connectWithUsersCollection();

    const userID = usersCollection.findOne({ key: key }, { _id: 1 });

    const user = await module.exports.get(userID);

    if (user) return user;
    return false;
  },
  get: async function (id) {
    const usersCollection = await mongo.connectWithUsersCollection();

    let user = await usersCollection.findOne(
      { _id: id },
      { projection: { password: 0, email: 0, confirmed: 0, key: 0 } }
    );

    if (user) {
      if (fs.existsSync(`./uploads/avatars/${id}.png`)) {
        user.avatar = `./uploads/avatars/${id}.png`;
      } else {
        user.avatar = `./uploads/avatars/regular.png`;
      }
      return results.successWithData(user);
    }
    return results.error("User not found", 400);
  },
  update: async function (key, updatedFileds) {
    const usersCollection = await mongo.connectWithUsersCollection();
    const userID = await module.exports.getUserWithKey(key)["_id"];

    if (!userID) {
      return results.error("User not found", 400);
    }

    const updated = {
      $set: updatedFileds,
    };

    const result = usersCollection.updateOne({ _id: userID }, updated);

    if (!result) {
        return results.error("Unexpected error", 500);
    }

    return results.success();
  }
};

function generateUserKey() {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < 32; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
