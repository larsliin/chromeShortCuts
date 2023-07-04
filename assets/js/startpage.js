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
const inpImport = document.getElementById('inp_import');
const btnExport = document.getElementById('btn_export');
const btnCancelSettings = document.getElementById('btn_cancel_settings');
const btnUpdateSettings = document.getElementById('btn_update_settings');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let imageFile;
let importFile;
let rootFolderId;
let editBookmarkId;
let sliderTimeout;
let currentSlideIndex = 0;
const goToOpenedLast = true;
let selectedFolderStr;
let selectedFolderId;

btnSettings.addEventListener('click', openSettings);
btnAddBookmark.addEventListener('click', openEditBookmark);
btnSubmit.addEventListener('click', onCreateBookmarkClick);
inpFolder.addEventListener('keydown', onInpKeyDown);
inpTitle.addEventListener('keydown', onInpKeyDown);
inpUrl.addEventListener('keydown', onInpKeyDown);
inpFile.addEventListener('change', onAddFile);
inpImport.addEventListener('change', onImportBtnClick);
btnExport.addEventListener('click', onExportBtnClick);
btnExport.addEventListener('click', onExportBtnClick);
btnCancelSettings.addEventListener('click', onUpdateCancel);
btnUpdateSettings.addEventListener('click', onUpdateSettings);



chrome.bookmarks.onCreated.addListener(onBrowserBookmarkCreated);
chrome.bookmarks.onRemoved.addListener(onBrowserBookmarkRemoved);

chrome.bookmarks.onMoved.addListener(onBrowserBookmarkMoved);

function onExportBtnClick() {
    exportBookmarks();
}

function onImportBtnClick(event) {
    const reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(event.target.files[0]);
}

function onReaderLoad(event) {
    importFile = JSON.parse(event.target.result);
}

function onUpdateCancel() {
    importFile = undefined;
}

async function onUpdateSettings() {
    if (importFile) {
        if (rootFolderId) {
            await removeBookmarksFolder(rootFolderId);
        }

        resetAll();

        await clearImageStorage();

        const response = await importFolders(importFile);

        const folderMapping = response.map(e => {
            const o = {};
            o.id = e.id;
            o.oldId = e.oldId;
            return o;
        });
        const flatObj = folderMapping.reduce((obj, item) => Object.assign(obj, { [item.oldId]: item.id }), {});

        const importBookmarksResponse = await importBookmarks(importFile, flatObj);

        //addImageToDom
        // filter all bookmarks that have an image assigned
        const imageBookmarks = importFile
            .map(obj => ({
                ...obj,
                children: obj.children.filter(child => child.hasOwnProperty('base64'))
            }))
            .filter(obj => obj.children.length > 0);

        // convert into a flattened array for easy iteration
        const flattenedChildren = imageBookmarks.map(obj => obj.children).flat();
        flattenedChildren.map(e => {
            const o = e;
            o.newId = importBookmarksResponse.find(a => a.oldId === e.id).id;
            return o;
        });

        await storeImages(flattenedChildren);

        for (const bookmark of flattenedChildren) {
            addImageToDom(bookmark);
        }
    }

    dialogSettings.close();

    importFile = undefined;
}

async function onBrowserBookmarkMoved(bookmarkid, eventobj) {
    const bookmark = await getBookmarkById(bookmarkid);

    if (bookmark.url) {
        reorderBookmarks(bookmark, eventobj);
    } else {
        reorderFolders(bookmark, eventobj);
    }
}

function reorderBookmarks(bookmark, eventobj) {
    if (!bookmark.url) {
        return;
    }
    const folderIdArr = bookmarks.map(e => e.id);

    // move bookmark into root folder
    if (!folderIdArr.includes(eventobj.oldParentId)) {
        const bookmarkChildren = bookmarks.find(e => e.id === eventobj.parentId).children;
        bookmarkChildren.splice(eventobj.index, 0, bookmark);

        addBookmarkToDOM(bookmark, eventobj.parentId, eventobj.index);
    }

    // move bookmarks internally
    if (folderIdArr.includes(eventobj.oldParentId) && folderIdArr.includes(eventobj.parentId)) {
        const index = eventobj.index > eventobj.oldIndex ? eventobj.index + 1 : eventobj.index;
        const folderBookmarks = bookmarks.find(e => e.children.find(a => a.id === bookmark.id)).children;
        const bookmarkElem = document.getElementById(`bookmark_${bookmark.id}`);
        const bookmarkContainer = document.querySelector(`#folder_${eventobj.parentId} .folder-inner`);

        arraymove(folderBookmarks, eventobj.oldIndex, eventobj.index);

        bookmarkContainer.insertBefore(bookmarkElem, bookmarkContainer.children[index]);
    }

    // move bookmark out of root folder
    if (folderIdArr.includes(eventobj.oldParentId) && !folderIdArr.includes(eventobj.parentId)) {
        onBrowserBookmarkRemoved(bookmark.id)
    }
}

async function reorderFolders(folder, eventobj) {
    // move bookmark into root folder
    if (eventobj.parentId === rootFolderId.toString() && eventobj.oldParentId !== rootFolderId.toString()) {
        const response = await getBookmarksInFolder(folder.id);
        const folderClone = folder;
        folderClone.children = response;
        bookmarks.splice(eventobj.index, 0, folderClone);

        addFolderToDOM(folderClone, eventobj.index);

        folderClone.children.forEach((bookmark) => {
            addBookmarkToDOM(bookmark, folder.id);
        });

        slide(eventobj.index);
    }

    // move bookmarks internally
    if (eventobj.parentId === rootFolderId.toString() && eventobj.oldParentId === rootFolderId.toString()) {
        arraymove(bookmarks, eventobj.oldIndex, eventobj.index);

        const index = eventobj.index > eventobj.oldIndex ? eventobj.index + 1 : eventobj.index;

        const folderElem = document.getElementById(`folder_${folder.id}`);
        foldersContainer.insertBefore(folderElem, foldersContainer.children[index]);
    }

    // move bookmark out of root folder
    if (eventobj.parentId !== rootFolderId.toString() && eventobj.oldParentId === rootFolderId.toString()) {
        bookmarks.splice(eventobj.oldIndex, 1);

        document.getElementById(`folder_${folder.id}`).remove();
        document.getElementById(`nav_${folder.id}`).remove();

        if (currentSlideIndex >= bookmarks.length) {
            slide(bookmarks.length - 1);
        }
    }

    buildNavigation();

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

    if (mdcSelect.selectedIndex < 0) {
        return;
    }
    selectedFolderStr = mdcSelect.value;
    selectedFolderId = bookmarks[mdcSelect.selectedIndex].id;
});


function openSettings() {
    dialogSettings.open();
}

function renderFolderSelect(selectedindex) {
    const folders = bookmarks.map(e => {
        const o = {};
        o.title = e.title;
        o.id = e.id;
        return o;
    });
    const index = selectedindex ? selectedindex : -1;
    inpSelectFolder.innerHTML = '';

    for (let i = 0; i < folders.length; i++) {
        const liElem = document.createElement('li');
        liElem.classList.add('mdc-list-item');
        liElem.setAttribute('data-value', folders[i].title);
        liElem.setAttribute('id', `folder_${folders[i].id}`);
        liElem.role = 'option'

        const rippleElem = document.createElement('span');
        rippleElem.classList.add('mdc-list-item__ripple')
        liElem.appendChild(rippleElem);

        const itemElem = document.createElement('span');
        itemElem.classList.add('mdc-list-item__text');
        itemElem.innerText = folders[i].title;
        liElem.appendChild(itemElem);

        inpSelectFolder.appendChild(liElem);
    }

    mdcSelect.layoutOptions();

    mdcSelect.setSelectedIndex(index);
}

inpTitle.value = Date.now();

dialogSettings.listen('MDCDialog:closed', () => {
    inpImport.value = '';
});

dialog.listen('MDCDialog:closed', () => {
    selectedFolderStr = null;
    selectedFolderId = null;
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
    imageFile = event.target.files[0];
}

async function onCreateBookmarkClick() {

    let folder = inpFolder.value;
    let folderId;

    if (document.getElementById('inp_radio_2').checked) {
        folderId = selectedFolderId;
        folder = selectedFolderStr;
    }

    const title = inpTitle.value;
    const url = inpUrl.value;

    if (editBookmarkId) {
        const homeFolderId = bookmarks.find(e => e.title === rootFolderKey).id;
        const parentId = folder === '' ? homeFolderId : folderId;
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
    await updateImage(id, imageFile);
    imageFile = null;
    updateBookmarkDOM({ parentId, id, title, url });

    dialog.close();
}

async function updateImage(id, img) {
    if (!img) {
        return;
    }

    const base64 = await getBase64Data(img);
    await setLocalStorage({ [id]: { image: base64 } });

}

async function updateBookmarkDOM(bookmark) {
    const bookmarkElem = document.getElementById(`bookmark_${bookmark.id}`);
    const imgElem = bookmarkElem.querySelector('.bookmark-image');
    bookmarkElem.querySelector('.bookmark-title-container').innerText = bookmark.title;
    bookmarkElem.querySelector('a').href = bookmark.url;
    if (imgElem) {
        const storageItem = await getLocalStorage(bookmark.id);

        imgElem.style.backgroundImage = `url('${storageItem.image}')`;
    } else {
        addImageToDom(bookmark);
    }
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
            setLocalStorage({ rootFolderId });
        }

        // create subfolder
        const folderName = o.folder ? o.folder : rootFolderKey;
        const existingFolder = await searchBookmarkFolder2(rootFolderId.toString(), folderName);

        if (existingFolder.length === 0) {
            // create bookmark folder if folder does not already exist
            const createdFolder = await createBookmarkFolder(rootFolderId, folderName);
            folder = createdFolder;
            subFolderId = createdFolder.id;
        } else {
            subFolderId = existingFolder[0].id;
            folder = existingFolder[0];
        }

        // if bookmark title then create bookmark in folder
        let bookmark;
        if (o.title && o.title !== '') {
            bookmark = await createBookmarkInFolder(subFolderId, o.title, o.url);
        }

        dialog.close();

        resolve({ folder, bookmark });
    });
}
/**
 * CHROME BOOKMARK CREATED HANDLER
 */
async function onBrowserBookmarkCreated(event, bookmark) {

    buildNavigation();
    if (bookmark.url) {
        // bookmark added
        const folder = bookmarks.find(e => e.id === bookmark.parentId);
        if (!folder.children) {
            folder.children = [];
        }
        folder.children.push(bookmark);

        const index = bookmarks.findIndex(e => e.id === bookmark.parentId);
        addBookmarkToDOM(bookmark, folder.id);

        if (imageFile) {
            await updateImage(bookmark.id, imageFile);
            imageFile = null;
            addImageToDom(bookmark);
        }

        slide(index);
    } else {

        // folder added
        if (bookmark.parentId === '2') {
            return;
        }

        bookmarks.push(bookmark);
        if (bookmarks.length) {
            const folder = bookmarks.find(e => e.id === bookmark.id);
            if (!document.getElementById(`folder_${folder.id}`)) {
                addFolderToDOM(folder);
            }
        }
    }
}

async function onBrowserBookmarkRemoved(bookmarkid) {
    const isRootFolder = bookmarkid === rootFolderId;

    if (isRootFolder) {
        setLocalStorage({ rootFolderId: null });
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
        if (!folder) {
            return;
        }

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

    clearStorageItem('rootFolderId');
    rootFolderId = null;
    currentSlideIndex = 0
    setLocalStorage({ sliderIndex: currentSlideIndex });
}

/*
 * RENDER BOOKMARKS
 */
// add bookmarks folder container to DOM
function addFolderToDOM(folder, index) {
    const container = document.createElement('div');
    const containerInner = document.createElement('div');
    container.className = 'folder';
    containerInner.className = 'folder-inner';
    container.id = `folder_${folder.id}`;
    container.appendChild(containerInner);

    if (index === undefined) {
        foldersContainer.appendChild(container);
    } else {
        foldersContainer.insertBefore(container, foldersContainer.children[index]);

    }
}

// add bookmark to DOM in container
async function addBookmarkToDOM(bookmark, folderid, index) {
    if (!bookmark.url) {
        return;
    }
    const linkContainerElem = document.createElement('span');

    const folderElem = document.getElementById(`folder_${folderid}`);
    const folderInnerElem = folderElem.querySelector(`.folder-inner`);

    const linkElem = document.createElement('a');
    linkElem.href = bookmark.url;
    linkElem.className = 'bookmark-link';
    linkContainerElem.appendChild(linkElem);


    const linkImgContainerElem = document.createElement('span');
    linkImgContainerElem.className = 'bookmark-image-container';
    linkElem.appendChild(linkImgContainerElem);

    const linkInnerShadowElem = document.createElement('span');
    linkInnerShadowElem.className = 'bookmark-image-inset';
    linkImgContainerElem.appendChild(linkInnerShadowElem);

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

    linkContainerElem.className = 'bookmark';
    linkContainerElem.id = `bookmark_${bookmark.id}`;

    if (index !== undefined) {
        const bookmarkContainer = document.querySelector(`#folder_${folderid} .folder-inner`);
        bookmarkContainer.insertBefore(linkContainerElem, bookmarkContainer.children[index]);
    } else {
        folderInnerElem.appendChild(linkContainerElem);
    }

    addImageToDom(bookmark);
}

function onEditClick(event) {
    const bookmarkId = event.currentTarget.id.split('_')[1];

    const folder = bookmarks.find(e => e.children.find(child => child.id === bookmarkId));
    const bookmark = folder.children.find(e => e.id === bookmarkId);
    editBookmarkId = bookmark.id;

    openEditBookmark();

    if (folder.title !== rootFolderKey) {
        //inpFolder.value = folder.title;
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
    const id = bookmark.newId ? bookmark.newId : bookmark.id;
    const linkImgContainerElem = document.querySelector(`#bookmark_${id} .bookmark-image-container`);

    if (!linkImgContainerElem) {
        return;
    }

    const storageItem = await getLocalStorage(id);

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
            o.title = e.title;
            o.parentId = e.parentId;
            return o;
        });
    } catch (error) {
        console.error(error);
    }
}

async function goToSlide() {
    if (goToOpenedLast) {

        let folderIndex = await getLocalStorage('sliderIndex');
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
    const rootId = await getLocalStorage('rootFolderId');

    if (rootId) {
        rootFolderId = rootId;
    }

    await initBookmarks();

    renderFolderSelect();

    buildNavigation();

    await goToSlide();

    bookmarks.forEach((folder) => {
        addFolderToDOM(folder);

        folder.children.forEach((bookmark) => {
            addBookmarkToDOM(bookmark, folder.id);
        });
    });

    foldersContainer.addEventListener('transitionend', onSlideEnd);

}

init();