let bookmarks = [];
const inpBookmarkFolder = document.getElementById('bookmark_folder');
const inpBookmarkTitle = document.getElementById('bookmark_title');
const inpBookmarkUrl = document.getElementById('bookmark_url');
const btnSubmit = document.getElementById('btn_submit');
const btnAddBookmark = document.getElementById('btn_add_bookmark');
const modal = document.getElementById('modal');
const addBookmark = document.getElementById('add_bookmark');
const foldersContainer = document.getElementById('folders_container');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let rootFolderId;

btnAddBookmark.addEventListener('click', onBtnAdBookmarkClick);
btnSubmit.addEventListener('click', onCreateShortcutClick);
inpBookmarkFolder.addEventListener('keydown', onInpKeyDown);
inpBookmarkTitle.addEventListener('keydown', onInpKeyDown);
inpBookmarkUrl.addEventListener('keydown', onInpKeyDown);

function onBtnAdBookmarkClick() {
    toggleModal(null, true);
}

function toggleModal(type, toggle) {
    if (toggle) {
        modal.classList.add('show');
        addBookmark.classList.add('show');
    } else {
        modal.classList.remove('show');
        addBookmark.classList.remove('show');
    }
}

function onInpKeyDown(event) {
    if (event.keyCode === 13) {
        onCreateShortcutClick();
        event.preventDefault();
    }
}

// on submit button click
async function onCreateShortcutClick() {
    const folderName = inpBookmarkFolder.value;
    const bookmarkTitle = inpBookmarkTitle.value;
    const bookmarkUrl = inpBookmarkUrl.value;
    const rootFolder = true;

    const response = await checkAndCreateBookmarkFolder({ rootFolder, folderName, bookmarkTitle, bookmarkUrl });
    console.log(response);

    const folderIndex = bookmarks.findIndex(e => e.id === response.folder.id);
    if (response.bookmark) {
        addBookmarkToDOM(folderIndex, response.bookmark)
    }
}

// create folder and/or bookmark
async function checkAndCreateBookmarkFolder(o) {
    return new Promise(async (resolve, reject) => {
        const existingRootFolder = await searchBookmarkFolder(rootFolderName);
        let subFolderId;
        let folder;

        if (!rootFolderId) {
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
                folder = createdRootFolder;
            } else {
                rootFolderId = existingRootFolder[0].id;
                createdRootFolder = existingRootFolder[0];
            }
        }

        // create subfolder
        if (o.folderName) {
            const existingFolder = await searchBookmarkFolder(o.folderName);

            if (existingFolder.length === 0) {
                // create bookmark folder if folder does not already exist
                const createdFolder = await createBookmarkFolder(rootFolderId, o.folderName);
                folder = createdFolder;
                subFolderId = createdFolder.id;
                bookmarks.push({
                    children: [],
                    id: subFolderId,
                    name: o.folderName,
                    parentId: rootFolderId,
                });
            } else {
                subFolderId = existingFolder[0].id;
                folder = existingFolder[0];
            }
        } else {
            subFolderId = rootFolderId;
            folder = existingRootFolder[0];
        }

        // if bookmark title then create bookmark in folder
        let bookmark;
        if (o.bookmarkTitle && o.bookmarkTitle !== '') {
            bookmark = await createBookmarkInFolder(subFolderId, o.bookmarkTitle, o.bookmarkUrl);
            const bookmarksFolder = bookmarks.find(e => e.id === bookmark.parentId);
            bookmarksFolder.children.push(bookmark);
        }

        toggleModal(null, false);

        resolve({ folder, bookmark }); // Resolve the promise to indicate completion
    });
}

function render() {
    bookmarks.forEach((folder, index) => {
        addFolderToDOM(folder.name, index);

        folder.children.forEach((bookmark) => {
            addBookmarkToDOM(index, bookmark);
        });
    });
}

function addFolderToDOM(name, index) {
    const folder = document.createElement('div');
    folder.className = 'folder';
    folder.id = `folder_${index}`;
    folder.title = name;
    foldersContainer.appendChild(folder);
}

function addBookmarkToDOM(folderindex, bookmark) {
    const folder = document.getElementById(`folder_${folderindex}`);

    const link = document.createElement('a');
    link.className = 'bookmark';
    link.href = bookmark.url;

    const linkImgContainer = document.createElement('span');
    linkImgContainer.className = 'bookmark-image-container';

    const linkTitleContainer = document.createElement('span');
    linkTitleContainer.className = 'bookmark-title-container';
    linkTitleContainer.innerText = bookmark.title;

    link.appendChild(linkImgContainer);
    link.appendChild(linkTitleContainer);

    folder.appendChild(link);
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
        // console.log(bookmarks);

        render();
    } catch (error) {
        console.error(error);
    }
}


initBookmarks();