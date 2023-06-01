const inpBookmarkFolder = document.getElementById('bookmark_folder');
const inpBookmarkTitle = document.getElementById('bookmark_title');
const inpBookmarkUrl = document.getElementById('bookmark_url');
const inpSubmit = document.getElementById('submit');

inpSubmit.addEventListener('click', onCreateShortcutClick);

function onCreateShortcutClick() { 
    const folderName = inpBookmarkFolder.value;
    const bookmarkTitle = inpBookmarkTitle.value;
    const bookmarkUrl = inpBookmarkUrl.value;
    const rootFolder = true;
    
    checkAndCreateBookmarkFolder({rootFolder, folderName, bookmarkTitle, bookmarkUrl});
}

async function searchBookmarkFolder(folderName) {
    return new Promise((resolve) => {
        chrome.bookmarks.search({ title: folderName }, (results) => {
            resolve(results);
        });
    });
}

async function createBookmarkFolder(folderName) {
    return new Promise((resolve) => {
        chrome.bookmarks.create({ title: folderName }, (folder) => {
            resolve(folder);
        });
    });
}

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

async function checkAndCreateBookmarkFolder(o) {
    const existingFolders = await searchBookmarkFolder(o.folderName);

    let folderId;

    if (existingFolders.length === 0) {
        const createdFolder = await createBookmarkFolder(o.folderName);
        folderId = createdFolder.id;
        console.log('Bookmark folder created:', createdFolder);
    } else {
        folderId = existingFolders[0].id;
        console.log('Existing bookmark folder found:', existingFolders[0]);
    }

    const createdBookmark = await createBookmarkInFolder(folderId, o.bookmarkTitle, o.bookmarkUrl);
    console.log('Bookmark created:', createdBookmark);
}