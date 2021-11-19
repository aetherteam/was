const User = require("./user.js");
const mongo = require("../utils/mongodb.js");
const validation = require("../utils/validation.js");
// TODO: links etc in comemnt and book description text.
module.exports = {
    create: async function (userID, bookID, text) {
        if (!validation.basic) {
            return results.error("Comment cannot be empty", 403);
        }

        const commentsCollection = await mongo.connectWithCommentsCollection();

        const comment = {
            _id: await mongo.getIDForNewEntry("comments"),
            owner: userID,
            book: bookID,
            text: text,
            timestamp: Date.now(),
        };

        const result = await commentsCollection.insertOne(comment);

        if (result.success) {
            reply.code(200).send({ data: result.data });
        } else {
            reply.code(result.code).send({ message: result.message });
        }
    },
    delete: async function (userID, commentID) {
        if (!checkCommentOwnership(userID, commentID)) {
            return results.error(
                "You have no rights to delete this comment",
                403
            );
        }

        const commentsCollection = await mongo.connectWithCommentsCollection();

        const result = await commentsCollection.deleteOne({ _id: commentID });

        if (result) {
            return results.success();
        } else {
            return results.unexpectedError();
        }
    },
    edit: async function (userID, commentID, text) {
        if (!checkCommentOwnership(userID, commentID)) {
            return results.error(
                "You have no rights to delete this comment",
                403
            );
        }

        const commentsCollection = await mongo.connectWithCommentsCollection();

        const updated = { $set: { text } };

        const result = commentsCollection.updateOne({ _id: commentID }, updated);
        
        if (result) {
            return results.success();
        } else {
            return results.unexpectedError();
        }
    },
};

async function checkCommentOwnership(userID, commentID) {
    const commentsCollection = await mongo.connectWithCommentsCollection();
    const comment = await commentsCollection.findOne({ _id: commentID });
    return comment["_id"] === userID;
}