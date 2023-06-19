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

async function getById(id) {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.get(id, (event) => {
            resolve(event);
        });
    });
}

async function setLocalStorage(payload) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(payload).then(() => {
            resolve();
        });
    });
}

async function getFromStorage(id) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(id, function (data) {
            resolve(data[id]);
        });
    });
}

async function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}