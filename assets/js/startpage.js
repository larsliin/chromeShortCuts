let bookmarks = [];
const inpBookmarkFolder = document.getElementById('bookmark_folder');
const inpBookmarkTitle = document.getElementById('bookmark_title');
const inpBookmarkUrl = document.getElementById('bookmark_url');
const inpSubmit = document.getElementById('submit');
const elemBookmarks = document.getElementById('bookmarks');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let rootFolderId;

inpSubmit.addEventListener('click', onCreateShortcutClick);

// on submit button click
async function onCreateShortcutClick() { 
    const folderName = inpBookmarkFolder.value;
    const bookmarkTitle = inpBookmarkTitle.value;
    const bookmarkUrl = inpBookmarkUrl.value;
    const rootFolder = true;

    await checkAndCreateBookmarkFolder({ rootFolder, folderName, bookmarkTitle, bookmarkUrl });
}

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

// create folder and/or bookmark
async function checkAndCreateBookmarkFolder(o) {
    let subFolderId;

    if (!rootFolderId) { 
        const existingRootFolder = await searchBookmarkFolder(rootFolderName);
        if (existingRootFolder.length === 0) {
            // create root folder if no root folder
            const createdRootFolder = await createBookmarkFolder('2', rootFolderName);
            rootFolderId = createdRootFolder.id;
            bookmarks.push({
                children: [],
                id: rootFolderId,
                name: rootFolderKey,
                parentId: '2',
            });
        } else {
            rootFolderId = existingRootFolder[0].id;
        }
    }

    // create subfolder
    if (o.folderName) {
        const existingFolders = await searchBookmarkFolder(o.folderName);

        if (existingFolders.length === 0) {
            // create bookmark folder if folder does not already exist
            const createdFolder = await createBookmarkFolder(rootFolderId, o.folderName);
            subFolderId = createdFolder.id;
            bookmarks.push({
                children: [],
                id: subFolderId,
                name: o.folderName,
                parentId: rootFolderId,
            });
        } else {
            subFolderId = existingFolders[0].id;
        }
    } else { 
        subFolderId = rootFolderId;
    }

    // if bookmark title then create bookmark in folder
    if (o.bookmarkTitle && o.bookmarkTitle !== '') { 
        const newBookmark = await createBookmarkInFolder(subFolderId, o.bookmarkTitle, o.bookmarkUrl);
        const bookmarksFolder = bookmarks.find(e => e.id === newBookmark.parentId);
        bookmarksFolder.children.push(newBookmark);
    }
    console.log(bookmarks);
}

// build flat array with bookmark folders and bookmark children for easier iteration
async function initBookmarks() {
    try {
        // get root bookmarks folder
        const rootFolder = await searchBookmarkFolder(rootFolderName);
        
        // if no bookmarks do not continue
        if (!rootFolder.length) { 
            return;
        }

        // get all content in root bookmarks folder
        const rootFolderBookmarks = await getBookmarksInFolder(rootFolder[0].id);

        // create array with bookmarks only in rootfolder
        const bookmarksFiltered = rootFolderBookmarks.filter(e => e.type === 'bookmark');

        // to make array prettier remove type from bookmarks directly under root folder
        const bookmarksWithoutType = bookmarksFiltered.map(bookmark => {
            const { type, ...rest } = bookmark;
            return rest;
        });

        // create array with all bookmarks folders in root folder
        const foldersFiltered = rootFolderBookmarks.filter(e => e.type === 'folder');

        // create folder objects with folder name and children in bookmarks folder
        bookmarks = foldersFiltered.map(e => {
            const o = {};
            o.children = e.children;
            o.id = e.id;
            o.name = e.title;
            o.parentId = e.parentId;
            return o;
        });
        
        // add root bookmarks as a bookmark folder to the beginning of bookmarks array
        bookmarks.unshift({
            children: bookmarksWithoutType,
            id: rootFolder[0].id,
            name: rootFolderKey,
            parentId: rootFolder[0].parentId,
        });
        console.log(bookmarks);
    } catch (error) {
        console.error(error);
    }
}

initBookmarks();