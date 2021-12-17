const fs = require("fs");
const validation = require("../utils/validation");
const Genres = require("./genres.js");
const User = require("./user.js");
const results = require("../utils/results.js");
const { getIDForNewEntry } = require("../utils/mongodb.js");
const getImagePath = require("../utils/getImagePath.js");

module.exports = {
    create: async function (
        name,
        chapters = [],
        genres = [],
        description = "",
        author
    ) {
        const booksCollection = global.mongo.collection("books");

        if (!validation.bookDescription(description)) {
            console.error("[Book] Description is too long");
            return results.error("Description is too long", 400);
        }
        if (!validation.basic(name)) {
            return results.error(
                "Name cannot be blank or be more than 128 symbols",
                400
            );
        }
        const _id = await getIDForNewEntry("books");

        const book = {
            _id,
            name,
            chapters,
            genres,
            description,
            author,
            timestamp: Date.now(),
            lastUpdate: Date.now(),
            likes: 0,
        };

        console.log("[Book] creating", book);
        const result = booksCollection.insertOne(book);

        if (result) {
            console.log("[Book] created");
            return results.successWithData(book);
        }

        return results.error("Unexpected error", 500);
    },
    checkOwnership: async function (bookID, userID) {
        const booksCollection = global.mongo.collection("books");
        const book = await booksCollection.findOne({ _id: parseInt(bookID) });

        console.log(book, userID);
        return book["author"] === userID;
    },
    addChapter: async function (bookID, name, content, author) {
        const booksCollection = global.mongo.collection("books");
        const chaptersCollection = global.mongo.collection("chapters");

        const doUserHaveRights = await module.exports.checkOwnership(
            bookID,
            author
        );

        if (!validation.chapterContent(content) || !validation.basic(name)) {
            console.log("[Chapter] Fields are invalid");
            return false;
        }

        if (!doUserHaveRights) {
            console.error(
                "[Book] User have no rights to create chapter for",
                bookID
            );
            return results.error("Forbidden", 403);
        }

        const chapterID = await getIDForNewEntry("chapters");
        const chapter = {
            _id: chapterID,
            bookID,
            name,
            content,
            author,
            timestamp: Date.now(),
        };

        if (await chaptersCollection.insertOne(chapter)) {
            const book = await booksCollection.findOne({
                _id: parseInt(bookID),
            });

            booksCollection.updateOne(
                { _id: parseInt(bookID) },
                {
                    $set: {
                        chapters: [...book["chapters"], chapterID],
                        lastUpdate: Date.now(),
                    },
                }
            );
            return results.successWithData(chapter);
        }
        return results.unexpectedError();
    },
    getChapter: async function (chapterID) {
        const chaptersCollection = global.mongo.collection("chapters");
        const chapter = chaptersCollection.findOne(
            { _id: parseInt(chapterID) },
            { projection: { content: 0, author: 0 } }
        );

        return chapter;
    },
    getOne: async function (bookID) {
        const chaptersCollection = global.mongo.collection("chapters");
        const booksCollection = global.mongo.collection("books");

        let book = await booksCollection.findOne({ _id: parseInt(bookID) });

        if (!book) {
            return results.error("Book not found", 400);
        }

        let chapters = [];
        await book.chapters.forEach(async (chapterID) => {
            let k = await module.exports.getChapterInfo(chapterID);
            chapters.push(k);
        });

        let genres = [];
        await book.genres.forEach(async (genreID) => {
            let x = await Genres.getByID(genreID);
            genres.push(x);
        });

        book.cover = getImagePath("cover", bookID);

        const author = await User.get(book.author);

        book.chapters = chapters;
        book.genres = genres;
        book.author = author.data;

        return results.successWithData(book);
    },
    get: async function (arrangeType, shift = 0, count = 10) {
        // const chaptersCollection = global.mongo.collection("chapters");
        const booksCollection = global.mongo.collection("books");

        let sort;
        if (arrangeType === "newest") {
            sort = ["timestamp", "desc"];
        } else if (arrangeType === "oldest") {
            sort = ["timestamp", "asc"];
        } else if (arrangeType === "popular") {
        } else if (arrangeType === "recommended") {
        } else {
            return results.error("ArrangeType is not defined!", 400);
        }

        const cursor = booksCollection.find({}, { sort });

        let books = [];
        let i = 1;

        await cursor.forEach((book) => {
            if (i > shift && i <= count) {
                books.push(book);
            }
            i++;
        });
        let cache = {
            genres: {},
            authors: {},
        };
        let result = [];
        for (const book of books) {
            let genres = [];
            await book.genres.forEach(async (genreID) => {
                console.log(cache);
                if (!cache.genres[genreID]) {
                    let x = await Genres.getByID(genreID);
                    genres.push(x);
                    cache.genres[toString(x._id)] = x;
                } else {
                    genres.push(genres[genreID]);
                }
            });

            book.cover = getImagePath("cover", book._id);

            let author;
            if (!cache.authors[book.author]) {
                author = await User.get(book.author);
                cache.authors[book.author] = author;
            } else {
                author = cache.authors[book.author];
            }

            book.genres = genres;
            book.author = author.data;

            result.push(book);
        }

        return results.successWithData(result);
    },
    like: async function (userID, bookID) {
        const bookLikesCollection = global.mongo.collection("bookLikes");
        const booksCollection = global.mongo.collection("books");

        const doUserLiked = await bookLikesCollection.findOne({
            userID,
            bookID,
        });

        let result;
        if (!doUserLiked) {
            result = await bookLikesCollection.insertOne({ userID, bookID });
            if (result) {
                await booksCollection.updateOne(
                    { _id: bookID },
                    { $inc: { likes: 1 } }
                );
                return results.successWithData({ action: "like" });
            }
        } else {
            result = await bookLikesCollection.deleteOne({ userID, bookID });
            if (result) {
                await booksCollection.updateOne(
                    { _id: bookID },
                    { $inc: { likes: 1 } }
                );
                return results.successWithData({ action: "unlike" });
            }
        }
        return results.unexpectedError();
    },
};
