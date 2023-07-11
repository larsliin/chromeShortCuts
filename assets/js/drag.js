const DRAGGING_CLASSNAME = 'dragging';

function compareOrder(elem1, elem2) {

    if (elem1.parentElement !== elem2.parentElement) {
        return null;
    }
    if (elem1 === elem2) {
        return 0;
    };

    if (elem1.compareDocumentPosition(elem2) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
    }
    return 1;
}

let DraggedTarget;
function addDragEventListeners(elem, draggedTarget) {
    elem.addEventListener('dragstart', (ev) => {
        draggedTarget.element = elem;

        elem.classList.add(DRAGGING_CLASSNAME);
    });

    elem.addEventListener('dragover', (ev) => {
        const order = compareOrder(elem, draggedTarget.element);

        ev.dataTransfer.dropEffect = 'move';
        ev.preventDefault();

        // If the `elem` and `draggedTarget.element` are not siblings with each
        // other, do nothing.
        if (!order) return;

        // Move `draggedTarget.element` to just before `elem`.
        const baseElement = order === -1 ? elem : elem.nextSlibing;

        draggedTarget.parent.insertBefore(draggedTarget.element, baseElement);
    });

    elem.addEventListener('dragend', (event) => {
        onDragEnd(event, elem)
    });
}

async function onDragEnd(event, elem) {
    elem.classList.remove(DRAGGING_CLASSNAME);

    const bookmarkElem = event.target.parentNode;
    const index = [...bookmarkElem.parentElement.children].indexOf(bookmarkElem);
    const id = bookmarkElem.getAttribute('id').split('_')[1];

    const bookmark = await getBookmarkById(id);

    const newIndex = index > bookmark.index ? index + 1 : index;
    chrome.bookmarks.move(id, { index: newIndex });
}

function buildDragAndDropInit(parent) {
    const target = { parent, element: undefined };

    const list = Array.from(parent.querySelectorAll('.bookmark.list'));

    list.forEach(function (item) {
        addDragEventListeners(item, target);
    });
}

function applyDragAndDrop(folderindex) {
    const folder = document.querySelectorAll('.folder')[folderindex];

    buildDragAndDropInit(folder.querySelector('.folder-inner'));
}