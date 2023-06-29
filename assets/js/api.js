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

async function updateBookmark(id, data) {
    return new Promise((resolve) => {
        chrome.bookmarks.update(
            id,
            {
                title: data.title,
                url: data.url,
            },
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

async function getBookmarkById(id) {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.get(id, (event) => {
            resolve(event[0]);
        });
    });
}

async function setLocalStorage(item) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(item).then(() => {
            resolve();
        });
    });
}

async function getLocalStorage(id) {
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

// search for bookmark folder by name to check if a specific folder already exists before creating new folder
async function searchBookmarkFolder2(parentFolderId, folderName) {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.getSubTree(parentFolderId, function (result) {
            const bookmarkTreeNodes = result[0].children;
            const folder = searchFolder(bookmarkTreeNodes, folderName);
            const folderResult = folder ? [folder] : [];
            resolve(folderResult);
        });
    });
}

function searchFolder(bookmarkTreeNodes, folderName) {
    for (let node of bookmarkTreeNodes) {
        if (node.title === folderName && node.children) {
            return node;
        }
        if (node.children) {
            const result = searchFolder(node.children, folderName);
            if (result) {
                return result;
            }
        }
    }
}