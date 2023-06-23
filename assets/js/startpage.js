let bookmarks = [];
const btnAddBookmark = document.getElementById('btn_add_bookmark');
const inpFolder = document.getElementById('inp_folder');
const inpTitle = document.getElementById('inp_title');
const inpUrl = document.getElementById('inp_url');
const inpFile = document.getElementById('inp_file');
const btnSubmit = document.getElementById('btn_submit');
const modal = document.getElementById('modal');
const foldersContainer = document.getElementById('folders_container');
const navContainer = document.getElementById('navigation_container');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let image;
let rootFolderId;
let editBookmarkId;
let sliderTimeout;
let currentSlideIndex = 0;
const goToOpenedLast = true;

btnAddBookmark.addEventListener('click', openEditBookmark);
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

function openEditBookmark() {
    const submitBtnText = editBookmarkId ? 'Update Bookmark' : 'Create Bookmark';
    btnSubmit.value = submitBtnText;
    btnSubmit.querySelector('.mdc-button__label').innerText = submitBtnText;

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
    const folder = inpFolder.value;
    const title = inpTitle.value;
    const url = inpUrl.value;

    if (editBookmarkId) {
        await editBookmark(editBookmarkId, { folder, title, url });
        editBookmarkId = null;
    } else {
        await createBookmark({ folder, title, url });
    }
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
 * EDIT BOOKMARK
 */
async function editBookmark(id, data) {
    bookmarks.find(obj => {
        if (Array.isArray(obj.children)) {
            const foundObject = obj.children.find(child => child.id === id);
            if (foundObject) {
                foundObject.folder = data.folder;
                foundObject.title = data.title;
                foundObject.url = data.url;
                return true;
            }
        }
        return false;
    });

    await updateBookmark(id, data);
    await updateImage(id);

    dialog.close();
}

async function updateImage(id) {
    if (!image) {
        return;
    }

    const base64 = await getBase64Data(image);
    await setLocalStorage({ [id]: { image: base64 } });
    image = null;
    // addImageToDom(bookmark);

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
        const folderName = o.folder ? o.folder : '_root';
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
        if (o.title && o.title !== '') {
            bookmark = await createBookmarkInFolder(subFolderId, o.title, o.url);
            if (image) {
                await updateImage(bookmark.id);
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
    const response = await getBookmarkById(event);
    const item = response[0];

    buildNavigation();

    if (item.url) {
        // bookmark added
        const folder = bookmarks.find(e => e.id === item.parentId);
        const index = bookmarks.findIndex(e => e.id === item.parentId);
        addBookmarkToDOM(item, folder);

        slide(folder.id);
    } else {
        // folder added
        if (bookmarks.length) {
            const folder = bookmarks.find(e => e.id === item.id);
            if (!document.getElementById(`folder_${folder.id}`)) {
                addFolderToDOM(folder);
            }
        }
    }
}

async function onBrowserBookmarkRemoved(event) {
    const isRootFolder = event === rootFolderId;

    if (isRootFolder) {
        resetAll();
        return;
    }

    const folder = bookmarks.find(e => e.id === event);
    if (folder) {
        const elem = document.getElementById(`folder_${folder.id}`);
        elem.remove();

        removeNavDot(event);

        bookmarks = bookmarks.filter(e => e.id !== event);

    } else {
        const folder = bookmarks.find(e => e.children.find(a => a.id === event));

        const bookmark = folder.children.find(e => e.id === event);
        const elem = document.getElementById(`bookmark_${bookmark.id}`);

        if (elem.parentNode.childNodes.length === 1) {
            chrome.bookmarks.remove(folder.id);
        } else {
            elem.remove();

            bookmarks = bookmarks.map(obj => ({
                ...obj,
                children: obj.children.filter(nestedObj => nestedObj.id !== event)
            }));
        }
    }
}

function resetAll() {
    bookmarks = [];
    foldersContainer.innerHTML = '';
    navContainer.innerHTML = '';

    foldersContainer.style.transform = ``;

    rootFolderId = null;
}

/*
 * RENDER BOOKMARKS
 */
// add bookmarks folder container to DOM
function addFolderToDOM(folder) {
    const container = document.createElement('div');
    const containerInner = document.createElement('div');
    container.className = 'folder';
    containerInner.className = 'folder-inner';
    container.id = `folder_${folder.id}`;
    container.setAttribute('_name', folder.name);
    container.setAttribute('_folder', folder.id);
    foldersContainer.appendChild(container);
    container.appendChild(containerInner);
}

// add bookmark to DOM in container
async function addBookmarkToDOM(bookmark, folder) {
    const folderElem = document.getElementById(`folder_${folder.id}`);
    const folderInnerElem = folderElem.querySelector(`.folder-inner`);

    const linkContainerElem = document.createElement('span');
    linkContainerElem.className = 'bookmark';
    linkContainerElem.id = `bookmark_${bookmark.id}`;
    folderInnerElem.appendChild(linkContainerElem);

    const linkElem = document.createElement('a');
    linkElem.href = bookmark.url;
    linkElem.className = 'bookmark-link';
    linkContainerElem.appendChild(linkElem);

    const linkImgContainerElem = document.createElement('span');
    linkImgContainerElem.className = 'bookmark-image-container';
    linkElem.appendChild(linkImgContainerElem);

    const linkTitleContainer = document.createElement('span');
    linkTitleContainer.className = 'bookmark-title-container';
    linkTitleContainer.innerText = bookmark.title;
    linkElem.appendChild(linkTitleContainer);

    const editElem = document.createElement('button');
    editElem.className = 'bookmark-edit';
    editElem.id = `edit_${bookmark.id}`;
    editElem.classList.add('bi-three-dots');
    editElem.classList.add('button-reset');
    editElem.addEventListener('click', onEditClick);
    linkContainerElem.appendChild(editElem);

    addImageToDom(bookmark);
}

function onEditClick(event) {
    const bookmarkId = event.currentTarget.id.split('_')[1];

    const folder = bookmarks.find(e => e.children.find(child => child.id === bookmarkId));
    const bookmark = folder.children.find(e => e.id === bookmarkId);
    editBookmarkId = bookmark.id;

    openEditBookmark();

    if (folder.name !== rootFolderKey) {
        inpFolder.value = folder.name;
        inpFolder.focus();
        inpFolder.blur();
    }
    if (bookmark.title) {
        inpTitle.value = bookmark.title;
        inpTitle.focus();
        inpTitle.blur();
    }
    if (bookmark.url) {
        inpUrl.value = bookmark.url;
        inpUrl.focus();
        inpUrl.blur();
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
        const imgElem = document.createElement('span');
        imgElem.style.backgroundImage = `url('${storageItem.image}')`;
        imgElem.classList = 'bookmark-image';

        linkImgContainerElem.classList.remove('bi-star-fill');
        linkImgContainerElem.appendChild(imgElem);
    } else {
        linkImgContainerElem.classList.add('bi-star-fill');
    }
}
/*
 * NAVIGATION
 */
// render navigation
function buildNavigation() {
    navContainer.innerHTML = '';

    if (bookmarks.length > 1) {
        bookmarks.forEach((bookmark) => {
            const navItemContainer = document.createElement('button');
            navItemContainer.className = 'navigation-item';
            navItemContainer.id = `nav_${bookmark.id}`;
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
    const folderId = event.currentTarget.id.split('_')[1];

    slide(folderId);
}

function removeNavDot(id) {
    const elem = document.getElementById(`nav_${id}`);
    if (elem) {
        document.getElementById(`nav_${id}`).remove();
    }

    const currentIndex = bookmarks.findIndex(e => e.id === id);

    if (bookmarks > 0 && currentIndex === bookmarks.length - 1) {
        slide(bookmarks[bookmarks.length - 2].id);
    }
}

// move bookmarks slider to folder
function slide(folderid) {
    const index = bookmarks.findIndex(e => e.id === folderid);

    if (index) {
        const x = -1 * (index * 100);
        foldersContainer.style.transform = `translateX(${x}%)`;
    } else {
        foldersContainer.style.transform = ``;
    }

    setActiveNav(document.querySelectorAll('.navigation-item')[index]);

    if (sliderTimeout) {
        clearTimeout(sliderTimeout);
        sliderTimeout = null;
    }

    currentSlideIndex = index;
}

function setActiveNav(item) {
    const navItem = document.querySelector('.navigation-item.active');
    if (navItem) {
        navItem.classList.remove('active');
    }

    if (!item) {
        return;
    }
    item.classList.add('active');
}

function onSlideEnd() {
    setLocalStorage({ sliderIndex: currentSlideIndex });
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

async function goToSlide() {
    if (goToOpenedLast) {

        let folderIndex = await getFromStorage('sliderIndex');

        if (folderIndex) {
            currentSlideIndex = bookmarks[folderIndex]?.id;

            slide(currentSlideIndex);
        }
    } else {
        setLocalStorage({ sliderIndex: 0 });
    }

    setTimeout(() => {
        foldersContainer.classList.add('animated');
        foldersContainer.classList.add('d-flex');
    }, 0);

    setActiveNav(document.querySelectorAll('.navigation-item')[currentSlideIndex]);
}

async function init() {
    await initBookmarks();

    buildNavigation();

    await goToSlide();


    bookmarks.forEach((folder, index) => {
        addFolderToDOM(folder);

        folder.children.forEach((bookmark) => {
            addBookmarkToDOM(bookmark, folder);
        });
    });

    foldersContainer.addEventListener('transitionend', onSlideEnd);
}

init();