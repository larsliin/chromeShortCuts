/*
 * NAVIGATION
 */
const navigationContainer = document.getElementById('navigation_container');
const navigationHeaderContainer = document.getElementById('navigation_header_container');

const goToOpenedLast = true;
let currentSlideIndex = 0;
let sliderTimeout;

// render navigation
function buildNavigation() {
    navigationContainer.innerHTML = '';

    if (bookmarks.length > 1) {
        bookmarks.forEach((bookmark) => {
            // header
            const navHeaderElement = document.createElement('h3');
            navHeaderElement.innerText = bookmark.title === homeFolderName ? homeFolderDisplayName : bookmark.title;
            navHeaderElement.className = 'navigation-header';
            navHeaderElement.id = `nav_header_${bookmark.id}`;
            navigationHeaderContainer.appendChild(navHeaderElement);

            // navigation
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
    const navElem = document.getElementById(`nav_${bookmarkid}`);
    const headerElem = document.getElementById(`nav_header__${bookmarkid}`);

    if (navElem) {
        navElem.remove();
    }

    if (headerElem) {
        headerElem.remove();
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

    applyDragAndDrop(currentSlideIndex);
}

function setActiveNav(item) {
    const navItem = document.querySelector('.navigation-item.active');
    const navHeader = document.querySelector('.navigation-header.active');

    if (navItem) {
        navItem.classList.remove('active');
    }

    if (navHeader) {
        navHeader.classList.remove('active');
    }

    if (!item) {
        return;
    }

    const id = item.id.split('_')[1];

    item.classList.add('active');
    document.getElementById(`nav_header_${id}`).classList.add('active');
}

function onSlideEnd() {
    setLocalStorage({ sliderIndex: currentSlideIndex });
}

async function goToSlide() {
    let folderIndex = await getLocalStorage('sliderIndex');

    setTimeout(() => {
        foldersContainer.classList.add('animated');
        foldersContainer.classList.add('d-flex');
    }, 0);

    if (goToOpenedLast) {
        if (folderIndex > bookmarks.length) {
            folderIndex = bookmarks.length - 1;
        }

        if (folderIndex !== undefined) {
            currentSlideIndex = bookmarks[folderIndex]?.id;

            slide(folderIndex);

            return;
        }
    } else {
        setLocalStorage({ sliderIndex: 0 });
    }
    applyDragAndDrop(0);

    setActiveNav(document.querySelectorAll('.navigation-item')[currentSlideIndex]);
}

function onNavArrowClick(event) {
    const dir = event.target.id.split('_')[2];
    let index = 0;
    switch (dir) {
        case 'left':
            if (currentSlideIndex > 0) {
                index = currentSlideIndex - 1;
            } else {
                index = 0;
            }
            break;
        case 'right':
            if (currentSlideIndex < bookmarks.length - 1) {
                index = currentSlideIndex + 1;
            } else {
                index = bookmarks.length - 1;
            }
            break;
    }
    slide(index);
}