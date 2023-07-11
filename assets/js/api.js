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

// move bookmark to folder
async function moveBookmark(id, destination) {
    return new Promise((resolve) => {
        chrome.bookmarks.move(
            id,
            destination,
            () => {
                resolve();
            },
        )
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

async function removeBookmarksFolder(id) {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.removeTree(
            id,
            () => {
                resolve();
            },
        )
    });
}

async function clearImageStorage() {
    const ids = bookmarks.flatMap(data => data.children.map(child => child.id));

    return new Promise((resolve, reject) => {
        if (ids.length) {
            chrome.storage.local.remove([ids], function () {
                var error = chrome.runtime.lastError;
                if (error) {
                    console.error(error);
                }
                resolve();
            })
        } else {
            resolve();
        }
    });
};

// remove local storage item
async function clearStorageItem(id) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove([id], function () {
            var error = chrome.runtime.lastError;
            if (error) {
                console.error(error);
            }
            resolve();
        })
    });
}


async function importFolders(obj) {
    const existingRootFolder = await searchBookmarkFolder2('2', rootFolderName);
    let folder;
    if (!rootFolderId) {
        if (existingRootFolder.length === 0) {
            // create root folder if no root folder
            const createdRootFolder = await createBookmarkFolder('2', rootFolderName);
            rootFolderId = createdRootFolder.id;

            folder = createdRootFolder;
            setLocalStorage({ rootFolderId });
        }
    }

    const promises = [];

    for (const folder of obj) {
        const promise = createBookmarkFolder(rootFolderId, folder.title);

        promises.push(promise.then(value => {
            value.oldId = folder.id;
            return value;
        }));
    }

    return await Promise.all(promises);
};

async function importBookmarks(bookmarks, flatObj) {
    const bookmarksFlat = bookmarks.map(item => {
        const children = item.children || [];
        const childIds = children.map(child => child);
        return [...childIds];
    }).flat();

    const promises = [];

    for (const bookmark of bookmarksFlat) {
        const promise = createBookmarkInFolder(flatObj[bookmark.parentId], bookmark.title, bookmark.url);

        promises.push(promise.then(value => {
            value.oldId = bookmark.id;
            return value;
        }));
    }

    const allPromises = await Promise.all(promises);
    return allPromises;
}

async function storeImages(obj) {
    return new Promise((resolve, reject) => {
        const promises = obj.map((item) => {
            return new Promise((resolve, reject) => {
                chrome.storage.local.set({ [item.newId]: { image: item.base64 } }, () => {
                    resolve();
                });
            });
        });

        Promise.all(promises)
            .then(() => {
                resolve(); // Resolve the outer promise
            })
            .catch((error) => {
                reject(error); // Reject the outer promise
            });
    });
};

async function getBase64ImageFromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Image download failed. Response status: ' + response.status);
        }

        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result;
                resolve(base64data);
            };
            reader.onerror = () => {
                reject(new Error('Failed to read the image file.'));
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        throw new Error('Failed to fetch the image URL: ' + error.message);
    }
}