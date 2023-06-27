let bookmarks = [];
const btnSettings = document.getElementById('btn_settings');
const btnAddBookmark = document.getElementById('btn_add_bookmark');
const inpFolder = document.getElementById('inp_folder');
const inpSelectFolder = document.getElementById('inp_select_folder');
const inpTitle = document.getElementById('inp_title');
const inpUrl = document.getElementById('inp_url');
const inpFile = document.getElementById('inp_file');
const btnSubmit = document.getElementById('btn_submit');
const modal = document.getElementById('modal');
const foldersContainer = document.getElementById('folders_container');
const navigationContainer = document.getElementById('navigation_container');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let image;
let rootFolderId;
let editBookmarkId;
let sliderTimeout;
let currentSlideIndex = 0;
const goToOpenedLast = true;
let folderStr;

btnSettings.addEventListener('click', openSettings);
btnAddBookmark.addEventListener('click', openEditBookmark);
btnSubmit.addEventListener('click', onCreateBookmarkClick);
inpFolder.addEventListener('keydown', onInpKeyDown);
inpTitle.addEventListener('keydown', onInpKeyDown);
inpUrl.addEventListener('keydown', onInpKeyDown);
inpFile.addEventListener('change', onAddFile);

chrome.bookmarks.onCreated.addListener(onBrowserBookmarkCreated);
chrome.bookmarks.onRemoved.addListener(onBrowserBookmarkRemoved);

chrome.bookmarks.onMoved.addListener(onBrowserBookmarkMoved);

async function onBrowserBookmarkMoved(bookmarkid, eventobj) {
    const bookmark = await getBookmarkById(bookmarkid);

    if (bookmark.url) {
        moveBookmark(bookmark, eventobj);
    } else {
        moveFolder(bookmark, eventobj);
    }
}

function moveBookmark(bookmark, eventobj) {
    const folderBookmarks = bookmarks.find(e => e.children.find(a => a.id === bookmark.id)).children;
    arraymove(folderBookmarks, eventobj.oldIndex, eventobj.index);

    const bookmarkElem = document.getElementById(`bookmark_${bookmark.id}`);
    const bookmarkContainer = document.querySelector(`#folder_${eventobj.parentId} .folder-inner`);

    const index = eventobj.index > eventobj.oldIndex ? eventobj.index + 1 : eventobj.index;
    if (eventobj.index > eventobj.oldIndex) {
        bookmarkContainer.insertBefore(bookmarkElem, bookmarkContainer.children[index]);
    } else {
        bookmarkContainer.insertBefore(bookmarkElem, bookmarkContainer.children[index]);
    }
}

function moveFolder(bookmark, eventobj) {
    arraymove(bookmarks, eventobj.oldIndex, eventobj.index);

    const index = eventobj.index > eventobj.oldIndex ? eventobj.index + 1 : eventobj.index;

    const folder = document.getElementById(`folder_${bookmark.id}`);
    foldersContainer.insertBefore(folder, foldersContainer.children[index]);

    const navBtn = document.getElementById(`nav_${bookmark.id}`);
    navigationContainer.insertBefore(navBtn, navigationContainer.children[index]);

    if (eventobj.index <= currentSlideIndex && eventobj.oldIndex >= currentSlideIndex) {
        currentSlideIndex = Math.min(currentSlideIndex + 1, bookmarks.length - 1);
    }

    setActiveNav(document.querySelectorAll('.navigation-item')[currentSlideIndex]);

}

function arraymove(arr, fromIndex, toIndex) {
    var element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
}

/*
 * ADD-BOOKMARK MODAL
 */

const dialogSettings = new mdc.dialog.MDCDialog(document.getElementById('dialog_settings'));
const dialog = new mdc.dialog.MDCDialog(document.getElementById('dialog_add_bookmark'));
const textFields = document.querySelectorAll('.mdc-text-field');

textFields.forEach((textField) => {
    new mdc.textField.MDCTextField(textField);
});

// initialize folder select dropdown
const mdcSelect = new mdc.select.MDCSelect(document.querySelector('.mdc-select'));
mdcSelect.listen('MDCSelect:change', () => {
    folderStr = mdcSelect.value;
});


function openSettings() {
    dialogSettings.open();
}

function renderFolderSelect(selectedindex) {
    const folders = bookmarks.map(e => e.name);
    const index = selectedindex ? selectedindex : -1;
    inpSelectFolder.innerHTML = '';

    for (let i = 0; i < folders.length; i++) {
        const liElem = document.createElement('li');
        liElem.classList.add('mdc-list-item');
        liElem.setAttribute('data-value', folders[i]);
        liElem.role = 'option'

        const rippleElem = document.createElement('span');
        rippleElem.classList.add('mdc-list-item__ripple')
        liElem.appendChild(rippleElem);

        const itemElem = document.createElement('span');
        itemElem.classList.add('mdc-list-item__text');
        itemElem.innerText = folders[i];
        liElem.appendChild(itemElem);

        inpSelectFolder.appendChild(liElem);
    }

    mdcSelect.layoutOptions();

    mdcSelect.setSelectedIndex(index);
}

inpTitle.value = Date.now();

dialog.listen('MDCDialog:closed', () => {
    folderStr = null;
    inpFolder.value = '';
    inpTitle.value = Date.now();
    inpUrl.value = 'http://123.com';
    inpFile.value = '';

    editBookmarkId = null;

    document.getElementById('inp_radio_1').checked = true;
    document.getElementById('fieldgroup_folder_text').classList.remove('d-none');
    document.getElementById('fieldgroup_folder_select').classList.remove('d-block');


});

dialog.listen('MDCDialog:opened', () => {
    inpFolder.focus();
    inpFolder.blur();

    inpTitle.focus();
    inpTitle.blur();

    inpUrl.focus();
    inpUrl.blur();
});

async function openEditBookmark() {
    const submitBtnText = editBookmarkId ? 'Update Bookmark' : 'Create Bookmark';
    btnSubmit.value = submitBtnText;
    btnSubmit.querySelector('.mdc-button__label').innerText = submitBtnText;

    let folderIndex = -1;
    if (editBookmarkId) {
        const bookmark = await getBookmarkById(editBookmarkId);

        folderIndex = bookmarks.findIndex(e => e.id === bookmark.parentId);
        document.getElementById('inp_radio_2').checked = true;
        document.getElementById('fieldgroup_folder_text').classList.add('d-none');
        document.getElementById('fieldgroup_folder_select').classList.add('d-block');

    }
    mdcSelect.setSelectedIndex(folderIndex);
    dialog.open();


}

// add-bookmark input elements event handlers
function onInpKeyDown(event) {
    if (event.keyCode === 13) {
        onCreateBookmarkClick();
        event.preventDefault();
    }
}

function onRadioFolderModeChange(event) {
    if (event.target.id === 'inp_radio_1') {
        document.getElementById('fieldgroup_folder_text').classList.remove('d-none');
        document.getElementById('fieldgroup_folder_select').classList.remove('d-block');
    } else {
        document.getElementById('fieldgroup_folder_text').classList.add('d-none');
        document.getElementById('fieldgroup_folder_select').classList.add('d-block');
    }
}

document.querySelectorAll("input[name='folderRadioGrp']").forEach((input) => {
    input.addEventListener('change', onRadioFolderModeChange);
});


function onAddFile(event) {
    image = event.target.files[0];
}

async function onCreateBookmarkClick() {
    let folder = inpFolder.value;

    if (document.getElementById('inp_radio_2').checked) {
        folder = folderStr;
    }

    const title = inpTitle.value;
    const url = inpUrl.value;

    if (editBookmarkId) {
        const parentId = folder === '' ? rootFolderKey : folder;
        await editBookmark(editBookmarkId, { parentId, title, url });
    } else {
        await createBookmark({ folder, title, url });
    }

    renderFolderSelect();
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
    let bookmark;
    const { parentId, title, url } = data;
    bookmarks.find(obj => {
        if (Array.isArray(obj.children)) {
            bookmark = obj.children.find(child => child.id === id);
            if (bookmark) {
                bookmark.parentId = parentId;
                bookmark.title = title;
                bookmark.url = url;
                return true;
            }
        }
        return false;
    });

    await updateBookmark(id, data);
    await updateImage(id);

    updateBookmarkDOM({ parentId, id, title, url });

    dialog.close();
}

async function updateImage(id) {
    if (!image) {
        return;
    }

    const base64 = await getBase64Data(image);
    await setLocalStorage({ [id]: { image: base64 } });
    image = null;

}

async function updateBookmarkDOM(bookmark) {
    const bookmarkElem = document.getElementById(`bookmark_${bookmark.id}`);
    const imgElem = bookmarkElem.querySelector('.bookmark-image');
    bookmarkElem.querySelector('.bookmark-title-container').innerText = bookmark.title;
    bookmarkElem.querySelector('a').href = bookmark.url;
    if (imgElem) {
        const storageItem = await getFromStorage(bookmark.id);

        imgElem.style.backgroundImage = `url('${storageItem.image}')`;
    } else {
        addImageToDom(bookmark);
    }
    // debugger;
}

/**
 * CREATE BOOKMARK AND FOLDER
 */
async function createBookmark(o) {
    return new Promise(async (resolve, reject) => {
        const existingRootFolder = await searchBookmarkFolder2('2', rootFolderName);
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
        const folderName = o.folder ? o.folder : rootFolderKey;
        const existingFolder = await searchBookmarkFolder2(rootFolderId.toString(), folderName);

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
    const item = response;

    buildNavigation();

    if (item.url) {
        // bookmark added
        const folder = bookmarks.find(e => e.id === item.parentId);
        const index = bookmarks.findIndex(e => e.id === item.parentId);
        addBookmarkToDOM(item, folder);

        slide(index);
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

async function onBrowserBookmarkRemoved(bookmarkid) {
    const isRootFolder = bookmarkid === rootFolderId;

    if (isRootFolder) {
        resetAll();
        return;
    }

    const folder = bookmarks.find(e => e.id === bookmarkid);

    if (folder) {
        const elem = document.getElementById(`folder_${folder.id}`);
        elem.remove();

        removeNavDot(bookmarkid);

        bookmarks = bookmarks.filter(e => e.id !== bookmarkid);

    } else {
        const folder = bookmarks.find(e => e.children.find(a => a.id === bookmarkid));

        const bookmark = folder.children.find(e => e.id === bookmarkid);
        const elem = document.getElementById(`bookmark_${bookmark.id}`);

        if (elem.parentNode.childNodes.length === 1) {
            chrome.bookmarks.remove(folder.id);
        } else {
            elem.remove();

            bookmarks = bookmarks.map(obj => ({
                ...obj,
                children: obj.children.filter(nestedObj => nestedObj.id !== bookmarkid)
            }));
        }
    }
}



function resetAll() {
    bookmarks = [];
    foldersContainer.innerHTML = '';
    navigationContainer.innerHTML = '';

    foldersContainer.style.transform = ``;

    rootFolderId = null;
    currentSlideIndex = 0
    setLocalStorage({ sliderIndex: currentSlideIndex });
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
        //inpFolder.value = folder.name;
        // inpFolder.focus();
        // inpFolder.blur();
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
    navigationContainer.innerHTML = '';

    if (bookmarks.length > 1) {
        bookmarks.forEach((bookmark) => {
            const navItemContainer = document.createElement('button');
            navItemContainer.className = 'navigation-item';
            navItemContainer.id = `nav_${bookmark.id}`;
            navItemContainer.addEventListener('click', onNavClick);

            const navItem = document.createElement('div');
            navItem.className = 'navigation-item-inner';

            navigationContainer.appendChild(navItemContainer);
            navItemContainer.appendChild(navItem);
        });
    }
}

// navtigation click handler
function onNavClick(event) {
    const childElements = Array.from(navigationContainer.children);
    const index = childElements.indexOf(event.currentTarget);

    slide(index);
}

function removeNavDot(bookmarkid) {
    const elem = document.getElementById(`nav_${bookmarkid}`);

    if (elem) {
        document.getElementById(`nav_${bookmarkid}`).remove();
    }

    const currentIndex = bookmarks.findIndex(e => e.id === bookmarkid);

    if (currentSlideIndex >= bookmarks.length - 1) {
        slide(bookmarks.length - 2);
    } else if (currentIndex < currentSlideIndex) {
        slide(currentSlideIndex - 1);
    }
}

// move bookmarks slider to folder
function slide(index) {
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
        const rootFolder = await searchBookmarkFolder2('2', rootFolderName);

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
        if (folderIndex > bookmarks.length) {
            folderIndex = bookmarks.length - 1;
        }
        if (folderIndex) {
            currentSlideIndex = bookmarks[folderIndex]?.id;

            slide(folderIndex);
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

    renderFolderSelect();

    buildNavigation();

    await goToSlide();

    bookmarks.forEach((folder) => {
        addFolderToDOM(folder);

        folder.children.forEach((bookmark) => {
            addBookmarkToDOM(bookmark, folder);
        });
    });

    foldersContainer.addEventListener('transitionend', onSlideEnd);
}

init();