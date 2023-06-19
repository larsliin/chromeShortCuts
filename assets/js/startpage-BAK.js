let bookmarks = [];
const inpBookmarkFolder = document.getElementById('bookmark_folder');
const inpBookmarkTitle = document.getElementById('bookmark_title');
const inpBookmarkUrl = document.getElementById('bookmark_url');
const inpBookmarFile = document.getElementById('bookmark_file');
const btnSubmit = document.getElementById('btn_submit');
const btnAddBookmark = document.getElementById('btn_add_bookmark');
const modal = document.getElementById('modal');
const addBookmark = document.getElementById('add_bookmark');
const foldersContainer = document.getElementById('folders_container');
const rootFolderName = 'Shortcutters';
const rootFolderKey = '_root';
let image;
let rootFolderId;
let addingBookmark = false;

btnSubmit.addEventListener('click', onCreateShortcutClick);
inpBookmarkFolder.addEventListener('keydown', onInpKeyDown);
inpBookmarkTitle.addEventListener('keydown', onInpKeyDown);
inpBookmarkUrl.addEventListener('keydown', onInpKeyDown);

inpBookmarFile.addEventListener('change', function (event) {
    image = event.target.files[0];
});

async function getBase64Data(file) {
    try {
        const base64Data = await toBase64(file);
        // Do something with the base64 data
        return base64Data;
    } catch (error) {
        console.error(error);
        // Handle any errors that occur during the conversion
        throw error; // Optionally rethrow the error
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
    // addingBookmark = true;
    const folderName = inpBookmarkFolder.value;
    const bookmarkTitle = inpBookmarkTitle.value;
    const bookmarkUrl = inpBookmarkUrl.value;

    const response = await checkAndCreateBookmarkFolder({ folderName, bookmarkTitle, bookmarkUrl });

    const folderIndex = bookmarks.findIndex(e => e.id === response.folder.id);
    const folder = bookmarks.find(e => e.id === response.folder.id);

    if (!document.getElementById(`folder_${folderIndex}`)) {
        addFolderToDOM(folder.name, folderIndex);

        buildNavigation();
    }

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
                chrome.storage.local.set({ [bookmark.id]: { image: base64 } });
            }

            const bookmarksFolder = bookmarks.find(e => e.id === bookmark.parentId);
            bookmarksFolder.children.push(bookmark);
        }

        dialog.close();

        resolve({ folder, bookmark }); // Resolve the promise to indicate completion
    });
}

function render() {
    bookmarks.forEach((folder, index) => {
        addFolderToDOM(folder, index);

        folder.children.forEach((bookmark) => {
            addBookmarkToDOM(index, bookmark);
        });
    });

    buildNavigation();
}

function addFolderToDOM(folder, index) {
    const container = document.createElement('div');
    container.className = 'folder';
    container.id = `folder_${index}`;
    container.setAttribute('_name', folder.name);
    container.setAttribute('_folder', folder.id);
    foldersContainer.appendChild(container);
}

async function addBookmarkToDOM(folderindex, bookmark) {
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

    const storageItem = await getFromStorage(bookmark.id);
    console.log(bookmark.id);
    console.log(storageItem);

    if (storageItem) {
        const img = document.createElement('img');
        img.src = storageItem.image;
        img.class = 'bookmark-image';
        linkImgContainer.appendChild(img);
    } else {
        linkImgContainer.classList.add('fill');
    }

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

        bookmarks = rootFolderBookmarks.map(e => {
            const o = {};
            o.children = e.children;
            o.id = e.id;
            o.name = e.title;
            o.parentId = e.parentId;
            return o;
        });

        render();

    } catch (error) {
        console.error(error);
    }
}

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

function onBrowserBookmarkCreated(event) {
    console.log('add');
    // if (!addingBookmark) {
    //     console.log('');
    //     foldersContainer.style.transform = ``;
    //     bookmarks = [];
    //     initBookmarks();
    // }
}

// chrome.bookmarks.onCreated.addListener(onBrowserBookmarkCreated);
// chrome.bookmarks.onRemoved.addListener(onBrowserBookmarkCreated);

const textFields = document.querySelectorAll('.mdc-text-field');
textFields.forEach((textField) => {
    new mdc.textField.MDCTextField(textField);
});

// Initialize the dialog component
const dialog = new mdc.dialog.MDCDialog(document.querySelector('#my-dialog'));

// Open the dialog when the trigger button is clicked
const triggerButton = document.querySelector('#my-dialog-trigger');
btnAddBookmark.addEventListener('click', () => {
    dialog.open();
});

initBookmarks();