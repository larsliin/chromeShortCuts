// search for bookmark folder by name to check if a specific folder already exists before creating new folder
async function searchBookmarkFolder(folderName) {
    return new Promise((resolve) => {
        chrome.bookmarks.search({ title: folderName }, (results) => {
            resolve(results);
        });
    });
}

// create bookmark folder
async function createBookmarkFolder(parentId, folderName) {
    return new Promise((resolve) => {
        chrome.bookmarks.create({ parentId: parentId, title: folderName }, (folder) => {
            resolve(folder);
        });
    });
}

// add new bookmark to specified folder (parentId)
async function createBookmarkInFolder(parentId, bookmarkTitle, bookmarkUrl) {
    return new Promise((resolve) => {
        chrome.bookmarks.create(
            { parentId, title: bookmarkTitle, url: bookmarkUrl },
            (bookmark) => {
                resolve(bookmark);
            }
        );
    });
}

// return all bookmarks in folder
// add type to make distinguishing between bookmarks and folders easier
async function getBookmarksInFolder(folderId) {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.getSubTree(folderId, (bookmarkTreeNodes) => {
            const folder = bookmarkTreeNodes[0];
            const bookmarks = folder.children;

            const bookmarkData = bookmarks.map((bookmark) => {
                bookmark.type = bookmark.children ? 'folder' : 'bookmark';
                return bookmark;
            });

            resolve(bookmarkData);
        });
    });
}