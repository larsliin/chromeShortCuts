let bookmarks = [];
const btnAddBookmark = document.getElementById('btn_add_bookmark');
const inpFolder = document.getElementById('inp_folder');
const inpTitle = document.getElementById('inp_title');
const inpUrl = document.getElementById('inp_url');
const inpFile = document.getElementById('inp_file');
const btnSubmit = document.getElementById('btn_submit');
const modal = document.getElementById('modal');
const addBookmark = document.getElementById('add_bookmark');
const foldersContainer = document.getElementById('folders_container');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let image;
let rootFolderId;
let addingBookmark = false;

btnAddBookmark.addEventListener('click', onAddBookMarkOpen);
btnSubmit.addEventListener('click', onCreateBookmarkClick);
inpFolder.addEventListener('keydown', onInpKeyDown);
inpTitle.addEventListener('keydown', onInpKeyDown);
inpUrl.addEventListener('keydown', onInpKeyDown);
inpFile.addEventListener('change', onAddFile);

chrome.bookmarks.onCreated.addListener(onBrowserBookmarkCreated);
chrome.bookmarks.onRemoved.addListener(onBrowserBookmarkRemoved);

/*
 * ADD-BOOKMARK MODAL
 */

const dialog = new mdc.dialog.MDCDialog(document.getElementById('dialog_add_bookmar'));
const textFields = document.querySelectorAll('.mdc-text-field');
textFields.forEach((textField) => {
    new mdc.textField.MDCTextField(textField);
});

function onAddBookMarkOpen() {
    dialog.open();
}

// add-bookmark input elements event handlers
function onInpKeyDown(event) {
    if (event.keyCode === 13) {
        onCreateBookmarkClick();
        event.preventDefault();
    }
}

function onAddFile(event) {
    image = event.target.files[0];
}

async function onCreateBookmarkClick() {
    const folderName = inpFolder.value;
    const bookmarkTitle = inpTitle.value;
    const bookmarkUrl = inpUrl.value;

    await createBookmark({ folderName, bookmarkTitle, bookmarkUrl });
}

async function getBase64Data(file) {
    try {
        const base64Data = await toBase64(file);
        return base64Data;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

/**
 * CREATE BOOKMARK AND FOLDER
 */
async function createBookmark(o) {
    return new Promise(async (resolve, reject) => {
        const existingRootFolder = await searchBookmarkFolder(rootFolderName);
        let subFolderId;
        let folder;
        if (!rootFolderId) {
            if (existingRootFolder.length === 0) {
                // create root folder if no root folder
                const createdRootFolder = await createBookmarkFolder('2', rootFolderName);
                rootFolderId = createdRootFolder.id;

                folder = createdRootFolder;
            } else {
                rootFolderId = existingRootFolder[0].id;
                createdRootFolder = existingRootFolder[0];
            }
        }

        // create subfolder
        const folderName = o.folderName ? o.folderName : '_root';
        const existingFolder = await searchBookmarkFolder(folderName);

        if (existingFolder.length === 0) {
            // create bookmark folder if folder does not already exist
            const createdFolder = await createBookmarkFolder(rootFolderId, folderName);
            folder = createdFolder;
            subFolderId = createdFolder.id;
            bookmarks.push({
                children: [],
                id: subFolderId,
                name: folderName,
                parentId: rootFolderId,
                type: createdFolder.type,
            });
        } else {
            subFolderId = existingFolder[0].id;
            folder = existingFolder[0];
        }

        // if bookmark title then create bookmark in folder
        let bookmark;
        if (o.bookmarkTitle && o.bookmarkTitle !== '') {
            bookmark = await createBookmarkInFolder(subFolderId, o.bookmarkTitle, o.bookmarkUrl);
            if (image) {
                const base64 = await getBase64Data(image);
                await setLocalStorage({ [bookmark.id]: { image: base64 } });
                addImageToDom(bookmark);
            }

            const bookmarksFolder = bookmarks.find(e => e.id === bookmark.parentId);
            bookmarksFolder.children.push(bookmark);
        }

        dialog.close();

        resolve({ folder, bookmark });
    });
}

/**
 * CHROME BOOKMARK CREATED HANDLER
 */
async function onBrowserBookmarkCreated(event) {
    const response = await getById(event);
    const item = response[0];

    if (item.url) {
        // bookmark added
        const folder = bookmarks.find(e => e.id === item.parentId);
        addBookmarkToDOM(item, folder);
    } else {
        // folder added
        const folder = bookmarks.find(e => e.id === item.id);
        const folderIndex = bookmarks.find(e => e.id === item.id);
        if (!document.getElementById(`folder_${folder.id}`)) {
            addFolderToDOM(folder);
        }
    }

    buildNavigation();
}

async function onBrowserBookmarkRemoved(event) {
    // debugger;
    const folder = bookmarks.find(e => e.id === event);
    if (folder) {
        console.log('folder deleted');
        console.log(folder);

        const elem = document.getElementById(`folder_${folder.id}`);
        elem.remove();
        bookmarks = bookmarks.filter(e => e.id !== event);
    } else {
        console.log('bookmark deleted');
        const folder = bookmarks.find(e => e.children.find(a => a.id === event));
        const bookmark = folder.children.find(e => e.id === event);
        const elem = document.getElementById(`bookmark_${bookmark.id}`);

        if (elem.parentNode.childNodes.length === 1) {
            // onBrowserBookmarkRemoved(folder.id);
            // debugger;
            chrome.bookmarks.remove({ id: folder.id });

        } else {
            elem.remove();

            bookmarks = bookmarks.map(obj => ({
                ...obj,
                children: obj.children.filter(nestedObj => nestedObj.id !== event)
            }));
        }
    }

}

/*
 * RENDER BOOKMARKS
 */
// add bookmarks folder container to DOM
function addFolderToDOM(folder) {
    const container = document.createElement('div');
    container.className = 'folder';
    container.id = `folder_${folder.id}`;
    container.setAttribute('_name', folder.name);
    container.setAttribute('_folder', folder.id);
    foldersContainer.appendChild(container);
}

// add bookmark to DOM in container
async function addBookmarkToDOM(bookmark, folder, addimage) {
    const folderElem = document.getElementById(`folder_${folder.id}`);

    const linkElem = document.createElement('a');
    linkElem.className = 'bookmark';
    linkElem.href = bookmark.url;
    linkElem.id = `bookmark_${bookmark.id}`;

    const linkImgContainerElem = document.createElement('span');
    linkImgContainerElem.className = 'bookmark-image-container';

    const linkTitleContainer = document.createElement('span');
    linkTitleContainer.className = 'bookmark-title-container';
    linkTitleContainer.innerText = bookmark.title;

    linkElem.appendChild(linkImgContainerElem);
    linkElem.appendChild(linkTitleContainer);

    folderElem.appendChild(linkElem);

    if (addimage) {
        addImageToDom(bookmark);
    }
}

// if image is stored in local storage, add image to DOM bookmark
async function addImageToDom(bookmark) {
    if (!bookmark) {
        return;
    }

    const linkImgContainerElem = document.querySelector(`#bookmark_${bookmark.id} .bookmark-image-container`);

    if (!linkImgContainerElem) {
        return;
    }

    const storageItem = await getFromStorage(bookmark.id);

    if (storageItem) {
        const imgElem = document.createElement('img');

        linkImgContainerElem.classList.remove('fill');
        imgElem.src = storageItem.image;
        imgElem.class = 'bookmark-image';
        linkImgContainerElem.appendChild(imgElem);
    } else {
        linkImgContainerElem.classList.add('fill');
    }
}
/*
 * NAVIGATION
 */
// render navigation
function buildNavigation() {
    const navContainer = document.getElementById('navigation_container');
    navContainer.innerHTML = '';

    if (bookmarks.length > 1) {
        bookmarks.forEach((bookmark) => {
            const navItemContainer = document.createElement('button');
            navItemContainer.className = 'navigation-item';
            navItemContainer.setAttribute('_folder', `${bookmark.id}`);
            navItemContainer.addEventListener('click', onNavClick);

            const navItem = document.createElement('div');
            navItem.className = 'navigation-item-inner';

            navContainer.appendChild(navItemContainer);
            navItemContainer.appendChild(navItem);
        });
    }
}

// navtigation click handler
function onNavClick(event) {
    const targetId = event.currentTarget.getAttribute('_folder');
    const index = bookmarks.findIndex(e => e.id === targetId);

    if (index) {
        const x = -1 * (index * 100);
        foldersContainer.style.transform = `translateX(${x}%)`;
    } else {
        foldersContainer.style.transform = ``;
    }
}

/**
 * INITIAL
 */
// build flat array with bookmark folders and bookmark
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

        bookmarks = rootFolderBookmarks.map(e => {
            const o = {};
            o.children = e.children;
            o.id = e.id;
            o.name = e.title;
            o.parentId = e.parentId;
            return o;
        });

    } catch (error) {
        console.error(error);
    }
}

async function init() {
    await initBookmarks();

    buildNavigation();

    buildNavigation();

    bookmarks.forEach((folder, index) => {
        addFolderToDOM(folder);

        folder.children.forEach((bookmark) => {
            addBookmarkToDOM(bookmark, folder, true);
        });
    });
}

init();