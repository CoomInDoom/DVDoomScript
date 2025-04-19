// -------------- START OF CODE --------------
// ==UserScript==
// @name         DVDoom
// @namespace    http://tampermonkey.net/
// @version      6.0.0
// @description  Changes in 6.0.0: 8chan support
// @author       Seianon and Mimorianon and Reisanon
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @namespace    rccom
// @match        *://8chan.moe/*/res/*
// @match        *://8chan.se/*/res/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addElement
// @grant        GM_addStyle
// @connect      8chan.moe
// @connect      8chan.se
// @connect      static.wikitide.net
// @connect      bluearchive.wiki
// @connect      schaledb.com
// @connect      rentry.org
// @connect      files.catbox.moe
// @connect      files.pixstash.moe
// @updateURL https://rentry.org/DVDoomSCRIPTchan/raw
// @downloadURL https://rentry.org/DVDoomSCRIPT8chan/raw
// @require https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// ==/UserScript==
(async function () {

    // Check for a thread.
    if (!/^bag\/|\/bag\/|Blue Archive|BIue Archive/.test(document?.querySelector('.postInfo.desktop .subject, .opHead .labelSubject')?.textContent?.trim() ?? '')) return;

    // Function used to fetch the data through userscript's fetch function allowing it to bypass Content Security Policy.
    const fetch = (function () {
        // If we are in the 4chan domain, set fetch as the default fetch.
        if (window.location.hostname === "4chan.org") return window.fetch;

        // Setup internal fetch logic to avoid extra construction of functions down during runtime.
        const _fetch = ((GM.xmlHttpRequest) ?
                (function (url, responseType) {
                    return GM.xmlHttpRequest({url, responseType});
                }) :
                (function (url, responseType) {
                    return new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            url,
                            responseType,
                            onloadend: (r) => resolve(r),
                            onerror: (r) => reject(r.statusText)
                        })
                    });
                })
        );

        // Return the actual fetch function to be stored in the fetch variable.
        return async function (targetUrl) {
            return {
                json: async function () {
                    return (await _fetch(targetUrl, "json")).response;
                },
                blob: async function () {
                    return (await _fetch(targetUrl, "blob")).response;
                },
                text: async function () {
                    return (await _fetch(targetUrl, "text")).responseText;
                },
            };
        };
    })();

    // Inserts an element with all its nested children into a target parent using GM_addElement
    const addElementToParent = (function () {
        // If we are in the 4chan domain, set fetch as the default function.
        if (window.location.hostname === "4chan.org") return (sourceElement, targetParent) => targetParent.appendChild(sourceElement);
        // Return the insertion function.
        return function (sourceElement, targetParent) {
            // Build an attributes object for GM_addElement
            const attributes = {};
            // Use getAttributeNames to get the original HTML attribute names
            const attributeNames = sourceElement.getAttributeNames();
            // Build an object with attribute names and values
            attributeNames.forEach(name => {
                attributes[name] = sourceElement.getAttribute(name);
            });

            // Create the element with GM_addElement
            const newElement = GM_addElement(targetParent, sourceElement.tagName.toLowerCase(), attributes);

            // Handle text content and children
            if (sourceElement.hasChildNodes()) {
                // Check if it only has text content (no element children)
                let hasElementChildren = false;
                for (let i = 0; i < sourceElement.childNodes.length; i++) {
                    if (sourceElement.childNodes[i].nodeType === Node.ELEMENT_NODE) {
                        hasElementChildren = true;
                        break;
                    }
                }

                if (!hasElementChildren) {
                    // If it only has text content, set it directly
                    newElement.textContent = sourceElement.textContent;
                } else {
                    // Process child elements
                    for (let i = 0; i < sourceElement.childNodes.length; i++) {
                        const childNode = sourceElement.childNodes[i];

                        if (childNode.nodeType === Node.ELEMENT_NODE) {
                            // Recursively process element nodes
                            addElementToParent(childNode, newElement);
                        } else if (childNode.nodeType === Node.TEXT_NODE && childNode.textContent.trim()) {
                            // For text nodes with content, add them as text
                            const textContent = childNode.textContent;

                            // We'll use a text span if needed
                            if (newElement.childNodes.length > 0) {
                                // Add as a span if there are other children
                                GM_addElement(newElement, 'span', {textContent: textContent});
                            } else {
                                // Set directly if this is the first/only child
                                newElement.textContent = textContent;
                            }
                        }
                    }
                }
            }

            return newElement;
        }
    })();

    //Adds HTML string content to a parent element using GM_addElement
    const addInnerHTMLToParent = (function () {
        // If we are in the 4chan domain, set the inner HTML as the default function.
        if (window.location.hostname === "4chan.org") return (targetParent, htmlString) => { targetParent.innerHTML = htmlString; };
                // Return the insertion function.
        return function addInnerHTMLToParent(parentElement, htmlString) {
            // Create a temporary container to parse the HTML
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = htmlString.trim();
            const addedElements = [];
            // Process each child node using the existing addElementToParent function
            Array.from(tempContainer.childNodes).forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && node.textContent.trim())) {
                    const newElement = addElementToParent(node, parentElement);
                    if (newElement) {
                        addedElements.push(newElement);
                    }
                }
            });
            return addedElements;
        }
    })();

    // hacky way of making images bypass CSP through GM tools
    const bypassedImageMutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            subscribeBypassedImage(mutation.target);
        });
    });
    const subscribeBypassedImage = (img) => {
        const parent = img.parentElement;
        let attrs = {};
        for (const node of img.attributes) attrs[node.name] = node.value;
        img.remove();
        const element = GM_addElement(parent, 'img', attrs);
        if (!element) throw new Error('wtf');
        bypassedImageMutationObserver.observe(element, {
            attributeFilter: ['src']
        });
    };

    // Function that proxies a catbox url into a pixstash if needed.
    const catboxReady = await async function(){
        // Attempt to fetch a 1B file from catbox.
        const catboxPing = await (new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                url: "https://files.catbox.moe/fl8hpc",
                onloadend: (r) => resolve(r),
                onerror: (r) => reject(r.statusText),
                timeout: 3000
            });
        }));
        // If successful use the regular url, otherwise use the proxy url.
        return (catboxPing.status === 200) ? ((url) => url) : ((url) => url.replace("files.catbox.moe", "files.pixstash.moe"));
    }();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// BIRTHDAY SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        let fullStringTop = "";
        let fullStringBottom = "";

        // Check if DVDoomParent exists, if not, create it
        let dvDoomParent = document.getElementById("DVDoomParent");
        if (!dvDoomParent) {
            dvDoomParent = document.createElement('div');
            dvDoomParent.id = "DVDoomParent";
            dvDoomParent.style.display = 'flex';
            dvDoomParent.style.marginLeft = '3.5px';
            dvDoomParent.style.marginRight = '12.5px';
            dvDoomParent.style.justifyContent = 'space-between';

            // Find an appropriate place to insert DVDoomParent
            let targetElement = document.querySelector('#threadList, .navLinks.desktop');
            if (targetElement) {
                targetElement.parentNode.insertBefore(dvDoomParent, targetElement);
            } else {
                document.body.appendChild(dvDoomParent);
            }
        }

        // Create and append the birthday and clock container
        let birthdayContainer = document.createElement('div');
        birthdayContainer.style.flexGrow = '5';
        birthdayContainer.style.flexBasis = '0';
        birthdayContainer.style.display = 'flex';
        birthdayContainer.style.flexDirection = 'column';
        birthdayContainer.style.alignItems = 'flex-start';
        birthdayContainer.style.justifyContent = 'center';

        // Add updated styles for birthday table with vertical header
        const birthdayStyles = `
            .birthday-table-container {
                width: fit-content;
                display: flex;
                align-items: stretch;
                gap: 0;
                margin: 0;
                height: fit-content;
            }
            .vertical-header {
                writing-mode: vertical-lr;
                transform: rotate(180deg);
                padding: 0 5px;
                border: 1px solid #ccc;
                border-radius: 0 5px 5px 0;
                border-left: none;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            }
            .birthday-table {
                border-collapse: separate;
                border-spacing: 0;
                border: 1px solid #ccc;
                border-radius: 0 5px 5px 0;
                overflow: hidden;
                margin: 0;
                width: auto;
                height: auto;
            }
            .birthday-table th, .birthday-table td {
                border-right: 1px solid #ccc;
                border-bottom: 1px solid #ccc;
                white-space: nowrap;
                padding: 8px;
            }
            .birthday-table th:last-child, .birthday-table td:last-child {
                border-right: none;
            }
            .birthday-table tr:last-child td {
                border-bottom: none;  /* Ensure last row has no bottom border */
            }
            .birthday-table tr {
                height: auto;
            }
            .image-container {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 60px;
                margin: auto;
            }
            .image-container img {
                max-width: 100%;
                max-height: 100%;
                display: block;
            }
        `;
        // Add the styles to the document
        const styleElement = document.createElement('style');
        styleElement.textContent = birthdayStyles;
        document.head.appendChild(styleElement);

        // Function to add days to a date
        function addDays(date, days) {
            const copy = new Date(Number(date));
            copy.setDate(date.getDate() + days);
            return copy;
        }

        // Fetch birthdays data from the API
        async function fetchBirthdays() {
            const response = await fetch('https://schaledb.com/data/en/students.json');
            const data = await response.json();

            const responseCustom = await fetch('https://rentry.org/dvdoombday/raw');
            const dataCustom = await responseCustom.json();

            // Iterate through each custom birthday list.
            for (let i = 0; i < dataCustom.length; i++) {
                // The current student.
                const customStudent = dataCustom[i];
                let actualStudent = {};
                // Check if it should replace.
                if (customStudent.Id) {
                    // Obtain the existing student.
                    actualStudent = data[customStudent.Id];
                } else {
                    data[`DVDOOM_${i}`] = actualStudent;
                }
                // Override the values.
                actualStudent.FamilyName = customStudent.FamilyName;
                actualStudent.PersonalName = customStudent.PersonalName;
                actualStudent.BirthDay = customStudent.BirthDay;
                actualStudent.DirectImage = customStudent.DirectImage;
            }

            return Object.values(data).reduce((acc, student) => {
                const birthdayMatch = student.BirthDay.match(/(\d+)\/(\d+)/);
                if (!birthdayMatch) return acc;

                const monthNumber = parseInt(birthdayMatch[1], 10);
                const day = parseInt(birthdayMatch[2], 10);

                if (!acc[monthNumber]) {
                    acc[monthNumber] = {};
                }
                if (!acc[monthNumber][day]) {
                    acc[monthNumber][day] = [];
                }

                const studentFullName = `${student.FamilyName} ${student.PersonalName}`;
                let studentEntry = acc[monthNumber][day].find(char => char.name === studentFullName);

                const studentImage = (student.DirectImage) ? student.DirectImage : `https://schaledb.com/images/student/collection/${student.Id}.webp`;

                if (studentEntry) {
                    if (!studentEntry.images.includes(studentImage)) {
                        studentEntry.images.push(studentImage);
                    }
                } else {
                    acc[monthNumber][day].push({
                        name: studentFullName,
                        images: [studentImage]
                    });
                }
                return acc;
            }, {});
        }

        async function initBirthdayAndClock() {
            const birthdays = await fetchBirthdays();
            const baseDate = new Date();
            // This loop checks for birthdays today and up to the next 7 days
            for (let i = 0; i <= 6; i++) {
                const currentDate = addDays(baseDate, i);
                const month = currentDate.getMonth() + 1;
                const day = currentDate.getDate();

                const studentsByBirthday = birthdays[month]?.[day];
                if (studentsByBirthday) {
                    fullStringTop += `<td style="font-weight: bold; padding: 8px; text-align: center;">${months[currentDate.getMonth()]} ${day}</td>`;
                    fullStringBottom += `<td style="font-weight: bold; text-align: center;">`;

                    for (const student of studentsByBirthday) {
                        fullStringBottom += `<div style="display: inline-block; padding: 8px;">
                            <div style="position: relative; text-align: justify;">
                                <center style="white-space: pre;">${student.name.replace(' ', '\n')}</center>
                                <center class="image-container" data-images="${student.images.join(',')}" style="width:60px;height:60px;" >`
                        for (let ii = 0; ii < student.images.length; ii++) {
                            fullStringBottom += `<img src="${catboxReady(student.images[ii])}" alt="${student.name}" style="width:60px; height:60px; display:${ii === 0 ? 'block' : 'none'}">`
                        }
                        fullStringBottom += `
                                </center>
                                </div>
                            </div>
                        `;
                    }

                    fullStringBottom += `</td>`;
                }
            }

            if (fullStringTop === '') {
                fullStringBottom = `
                <td style="font-weight: bold; text-align: center;">
                    <div style="display: inline-block; padding: 8px;">
                        <div style="position: relative; text-align: justify;">
                            <center style="white-space: pre;">No upcoming student birthdays in the next 7 days</center>
                        </div>
                    </div>
                </td>
            `;
            }

            // Updated HTML structure with vertical header
            birthdayContainer.innerHTML = `
                <div class="birthday-table-container">
                    <div class="vertical-header">Student Birthdays</div>
                    <table class="birthday-table">
                        <tr>${fullStringTop}</tr>
                        <tr>${fullStringBottom}</tr>
                    </table>
                </div>
            `;
            addElementToParent(birthdayContainer, dvDoomParent);

            document.querySelectorAll('.image-container').forEach(container => {
                const imageElements = Array.from(container.querySelectorAll('img'));
                if (imageElements.length <= 1) return;

                let currentIndex = 0;
                setInterval(() => {
                    imageElements[currentIndex].style.display = 'none';
                    currentIndex = (currentIndex + 1) % imageElements.length;
                    imageElements[currentIndex].style.display = 'block';
                }, 5000);
            });
        }

        // Initialize the birthday and clock functionality
        await initBirthdayAndClock();
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// CLOCKS SECTION ///////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        // Check if DVDoomParent exists, if not, create it
        let dvDoomParent = document.getElementById("DVDoomParent");
        if (!dvDoomParent) {
            dvDoomParent = document.createElement('div');
            dvDoomParent.id = "DVDoomParent";
            dvDoomParent.style.display = 'flex';
            dvDoomParent.style.marginLeft = '3.5px';
            dvDoomParent.style.marginRight = '12.5px';
            dvDoomParent.style.justifyContent = 'space-between';

            // Find an appropriate place to insert DVDoomParent
            let targetElement = document.querySelector('#threadList, .navLinks.desktop');
            if (targetElement) {
                targetElement.parentNode.insertBefore(dvDoomParent, targetElement);
            } else {
                document.body.appendChild(dvDoomParent);
            }
        }

        // Modify the table creation part
        document.getElementById("DVDoomParent").insertAdjacentHTML(
            'beforeend',
            `<div style="flex-grow: 2; flex-basis: 0; align-items: center; justify-content: center; display: flex;">
                <table id="seia-table" class="dvdoom-table" style="border: 1px solid #ccc; border-radius: 5px; flex: 1;">
                    <tr><th id="clockJST" colspan="100%" style="width: 100%; font-size: 18px; font-weight: bold; padding: 12px; text-align: center; border-bottom-width: 0px;">JST TIME</th></tr>
                    <tr><th id="clockUTC" colspan="100%" style="width: 100%; font-size: 18px; font-weight: bold; padding: 12px; text-align: center; border-top: 1px solid #ccc; border-bottom-width: 0px;">UTC TIME</th></tr>
                </table>
            </div>
        `);

        // Clock logic
        const clockCallbacks = {};
        const clockJST = document.getElementById("clockJST");
        const clockUTC = document.getElementById("clockUTC");
        const clockStyle = {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            weekday: "short",
            month: "long",
            day: "numeric",
            hourCycle: 'h23'
        }
        setInterval(() => {
            const dateToUpdate = new Date();
            clockJST.textContent = dateToUpdate.toLocaleString('en-US', {
                ...clockStyle,
                ...{
                    timeZone: 'Japan'
                }
            }).replace(' at', ',') + ' JST';
            clockUTC.textContent = dateToUpdate.toLocaleString('en-US', {
                ...clockStyle,
                ...{
                    timeZone: 'UTC'
                }
            }).replace(' at', ',') + ' UTC';
            for (const [_, callbackFunction] of Object.entries(clockCallbacks)) {
                callbackFunction(dateToUpdate);
            }
        }, 1000);
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// DVDOOM SECTION ///////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        // Inject styles
        const styleElement = document.createElement('style');
        styleElement.textContent = `
        .image-container { display: flex; align-items: center; justify-content: center; height: 60px; margin: auto; }
        .image-container img { max-width: 100%; max-height: 100%; display: block; }
        .centered-text { text-align: center; margin: 0; font-size: 14px; line-height: 20px; height: 20px; overflow: hidden; }
        .student-name { display: block; width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .seia-heart { display: inline-block; width: 200px; aspect-ratio: 1; border-image: radial-gradient(red 69%, #0000 70%) 84.5%/50%; clip-path: polygon(-41% 0, 50% 91%, 141% 0); }
        @keyframes seia-heart-animation { from { transform: translate3d(0, 0, 0); opacity: 0.65; } }
        .seia-text { font: 800 20px Arial; -webkit-text-fill-color: black; -webkit-text-stroke: 1px; -webkit-text-stroke-color: white}

        .quantity {   display: flex;   align-items: center;   justify-content: center;   padding: 0; }
        .quantity__minus, .quantity__plus {   display: block;   flex-grow: 1;  width: 0; height: 23px;   margin: 0;   background: #dee0ee;   text-decoration: none;   text-align: center;   line-height: 23px; }
        .seia-button {  display: block;   margin: 0;   background: #dee0ee;   text-decoration: none;   text-align: center;   line-height: 23px; }
        .seia-button:hover {  cursor: pointer; background: #575b71; color: currentColor !important; }
        .quantity__minus:hover, .quantity__plus:hover {  cursor: pointer; background: #575b71; color: #fff !important; }
        .quantity__minus {   border-radius: 3px 0 0 3px; -webkit-user-select: none; -moz-user-select: none; -khtml-user-select: none; -ms-user-select: none; }
        .quantity__plus {   border-radius: 0 3px 3px 0; -webkit-user-select: none; -moz-user-select: none; -khtml-user-select: none; -ms-user-select: none; }
        .quantity__input {   width: 40px;   height: 19px;   margin: 0;   padding: 0;   text-align: center;   border-top: 2px solid #dee0ee;   border-bottom: 2px solid #dee0ee;   border-left: 1px solid #dee0ee;   border-right: 2px solid #dee0ee;   background: #fff;   color: #8184a1; }
        input.quantity__input[type=number] { -moz-appearance: textfield; }
        input.quantity__input::-webkit-outer-spin-button, input.quantity__input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .quantity__minus:link, .quantity__plus:link {   color: #8184a1; }
        .quantity__minus:visited, .quantity__plus:visited {   color: #fff; }
    `;
        // Add these styles to your existing styles
        const dvdoomStyles = `

  .drawer {
    position: fixed;
    right: -200px;
    top: 0;
    width: 200px;
    height: 100vh;
    box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
    transition: right 0.3s ease;
    z-index: 9999;
    display: flex;
    flex-direction: column;
  }

  .drawer::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: inherit;
    background-attachment: fixed;
    z-index: -1;
  }

  .drawer.open {
    right: 0;
  }

  .drawer-header {
    padding: 20px;
    border-bottom: 1px solid #ccc;
    font-weight: bold;
    text-align: center;
    flex-shrink: 0;
    position: relative;
    background-color: rgba(222, 224, 238, 0.05);
    backdrop-filter: blur(5px);
  }

  .drawer-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 20px 20px 20px 10px;
    height: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
    margin-right: -10px;
  }

  .drawer-content::-webkit-scrollbar {
    width: 6px;
  }

  .drawer-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .drawer-content::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .drawer-footer {
    padding: 20px;
    border-top: 1px solid #ccc;
    flex-shrink: 0;
    position: relative;
    background-color: rgba(222, 224, 238, 0.05);
    backdrop-filter: blur(5px);
  }

  .menu-item {
    margin-bottom: 20px;
    padding: 15px;
    border: 1px solid #ccc;
    border-radius: 5px;
    transition: background-color 0.3s ease;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(5px);
    position: relative;
  }

  .menu-item-header {
    font-weight: bold;
    margin-bottom: 10px;
  }

  .menu-item-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quantity {
    margin-bottom: 10px;
  }

  .eos-button {
    width: 100%;
    padding: 10px;
    background: #dee0ee;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s ease;
  }

  .eos-button:hover {
    background: #575b71;
    color: white;
  }

  .shortcut.brackets-wrap .seia-drawer-button {
    --sexy-seia-mask: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAYAAAA+s9J6AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAEQUlEQVR4nO3dXVLbQBBGUZFi/1t2XqCKOID/JH3dPedsAI1a1yPJkGwbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALCGy4f0ccDe3tIHcMtv4b29vZU/fril/EV8z+4nxjmu573CbMsv8N5b0BWGNc0jjxeT51t6YY8+A04e1BR7PNdPm3Ppxbw6sGnD6uiol2mTZlt2IXsOb9LAOjjrLfaUuZZdxBGDnDK0ilJfH02YackFHDnQCUOrJP3d7YR5llzA0YOdMLikdHjXus+z3MF7nqirWnyfus/yT/oAUvwa3GOcq+OU+gTxcF9Lp/A6z/A9fQAVXC6XS+ch7qlTeFOUufAqDH/lECuc/1d0np2d8IvPC7HzQB/VPb4JRPiNFWIUXx0l3o5WvSCqHterpq6rqxIRVjbtq4xJa5lChHeacPFOWMNE8WeejhdGt2fFjuf4Ud1m8lX8wLteIB2G3vXcPqvDTL4TPejuF0nVoXc/r8+qOo9bPBO+oOJLm2rHw20i3EGVC7/KcfCYWITTLpj0etI/n+fZCXeUCkGAfZ8Hty34YmbyhXPWBTH5HD6ja4h2wgOIg0dEIlzhIj16jSucw1X4K4oDPfPXGPf8XwwCnCVyD73iRfQZ04prP0vXZ0I74UnEx09OfyZ0McK/vB2FMBEyQtfnwW0TIcSJEMJECGGnRujNKPzPTghhIoQwEULYad+teB7kKJ2/I9w2OyHEiRDCRAhhIoQwEUKYCCFMhBAmQlrr/h3htokQ4kRIWxN2wW0TIU1NCXDbREhDkwLctpMi9Mvb8LPDP1EEyBEm7YaH7oQChNsOi1CAcJ/dt3TxcZYpt6S7LkKAnG1CiLstQIAkdY5xlwMXIBV0DdGX9YzRdTN4+ZOj68KZq9uO+NLBCpCqOoXodpSROm0QT0fYaZFQ2VNbtgDposNtqdtRRuuwYTz8KdFhUXCt8o5oJ4QwEbKEyndwImQZVUMUIYSJkKVU3A1FCGEiZDnVdkMRsqRKIYoQwkQIYSJkWVVuSUUIYSKEMBGytAq3pCJkeekQRQhhIoQwEUKYCCFMhLBlX86IEMJECGEihDARwofUc6EIIUyE8EViN3w/+wfCFN8F+8w/t28nhCu3dsPLh71+np0Q7nTUraoI4YajnxPdjsIvznhRYyeEb5z5ltROCGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRAhhIoQwEUKYCCFMhBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRAhhIoQwEUKYCCFMhBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRAgAAAAAAAAAAAAAAAAAAAAAAAAAAPP8BdmTsINzIN40AAAAAElFTkSuQmCC);

    display: inline-block;
    width: 14px;
    height: 14px;
    -webkit-mask-image: var(--sexy-seia-mask);
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-image: var(--sexy-seia-mask);
    mask-size: contain;
    mask-repeat: no-repeat;
    background-color: currentColor;
    vertical-align: middle;
  }

  #seiaHoleLink {
    display: inline-flex;
    align-items: center;
  }
`;

        styleElement.textContent += dvdoomStyles;
        document.head.appendChild(styleElement);

        // Create the main drawer
        const drawer = document.createElement('div');
        drawer.className = 'drawer';
        // Create drawer header
        const drawerHeader = document.createElement('div');
        drawerHeader.className = 'drawer-header';
        drawerHeader.textContent = '< Seia DVD Menu >';
        drawer.appendChild(drawerHeader);
        // Create drawer content
        const drawerContents = document.createElement('div');
        drawerContents.className = 'drawer-content';
        drawer.appendChild(drawerContents);
        // Create drawer footer
        const drawerFooter = document.createElement('div');
        drawerFooter.className = 'drawer-footer';
        drawer.appendChild(drawerFooter);
        // Create EoS button
        const eosButton = document.createElement('button');
        eosButton.className = 'eos-button';
        eosButton.textContent = 'EoS';
        eosButton.onclick = function() { EOS = true; };
        drawerFooter.appendChild(eosButton);
        // Add the drawer to the document
        document.body.appendChild(drawer);
        
        // Check if it's 4chanX.
        if (document.getElementById('shortcuts')) {
            const shortcuts = document.getElementById('shortcuts');
            const shortcutChildren = shortcuts.children;
            const lastElement = shortcutChildren[shortcutChildren.length - 1];

            const openDrawerButtonElement = document.createElement('span');
            openDrawerButtonElement.id = 'shortcut-seia';
            openDrawerButtonElement.className = 'shortcut brackets-wrap';
            openDrawerButtonElement.innerHTML = `<a href="javascript:;" title="Seia Menu"><span class="seia-drawer-button"></span></a>`;
            shortcuts.insertBefore(openDrawerButtonElement, lastElement);

            openDrawerButtonElement.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                drawer.classList.toggle('open');
            });
        // Check if it's vanilla 4chan.
        } else if(document.getElementById('navtopright')){
            // Classic 4chan
            const navTopRight = document.getElementById('navtopright');
            if (navTopRight) {
                // Insert before the last bracket
                navTopRight.insertAdjacentHTML('afterbegin', ` [<a href="javascript:void(0);" id="seiaMenuLink">Seia</a>] `);
                const openDrawerButtonElement = document.getElementById('seiaMenuLink');
                if (openDrawerButtonElement) {
                    openDrawerButtonElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        drawer.classList.toggle('open');
                    });
                }
            }
        // Check if it's Lynxchan
        } else if (document.getElementById('navLinkSpan')) {
            const navHeader = document.getElementById('navLinkSpan').parentNode;

            let navOptionsSeiaSpan = document.getElementById('navOptionsSeiaSpan');
            if (!navOptionsSeiaSpan) {
                navOptionsSeiaSpan = document.createElement('span');
                navOptionsSeiaSpan.id = 'navOptionsSeiaSpan';
                navOptionsSeiaSpan.innerHTML = ' <span>|</span>'
                navHeader.appendChild(navOptionsSeiaSpan);
            }

            const openDrawerButtonElement = document.createElement('span');
            openDrawerButtonElement.id = 'shortcut-seia';
            openDrawerButtonElement.className = 'shortcut brackets-wrap';
            openDrawerButtonElement.innerHTML = ` <a href="javascript:;" title="Seia Menu"><span class="seia-drawer-button"></span></a> |`;

            const navOptionsSeiaSpanChildren = navOptionsSeiaSpan.children;
            const lastElement = navOptionsSeiaSpanChildren[navOptionsSeiaSpanChildren.length - 1];
            navOptionsSeiaSpan.appendChild(openDrawerButtonElement);

            openDrawerButtonElement.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                drawer.classList.toggle('open');
            });
        // Assume it's classic LynxChan.
        } else {
            // Classic LynxChan
            const navTopRight = document.getElementsByClassName('innerUtility top')[0];
            if (navTopRight) {
                // Insert before the last bracket
                navTopRight.insertAdjacentHTML('afterbegin', ` [<a href="javascript:void(0);" id="seiaMenuLink">Seia</a>] `);
                const openDrawerButtonElement = document.getElementById('seiaMenuLink');
                if (openDrawerButtonElement) {
                    openDrawerButtonElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        drawer.classList.toggle('open');
                    });
                }
            }
        }

        // Keep the click-outside handler
        document.addEventListener('click', (e) => {
            const isButton = e.target.matches('#seiaMenuLink, .seia-drawer-button, #shortcut-seia a');
            if (!drawer.contains(e.target) && !isButton) {
                drawer.classList.remove('open');
            }
        });

        // Function to copy background to drawer
        function copyBodyBackground(drawer) {
            // Get computed styles from both html and body elements
            const htmlStyle = window.getComputedStyle(document.documentElement);
            const bodyStyle = window.getComputedStyle(document.body);

            // Combine background properties, prioritizing html background-color if it exists
            const backgroundColor = htmlStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? htmlStyle.backgroundColor : bodyStyle.backgroundColor;

            drawer.style.background = bodyStyle.background;
            drawer.style.backgroundColor = backgroundColor;
            drawer.style.backgroundImage = bodyStyle.backgroundImage;
            drawer.style.backgroundSize = bodyStyle.backgroundSize;
            drawer.style.backgroundPosition = bodyStyle.backgroundPosition;
            drawer.style.backgroundRepeat = bodyStyle.backgroundRepeat;
            drawer.style.backgroundAttachment = 'fixed';
        }


        // Helper function to convert color to rgba with opacity
        function colorToRGBA(color, opacity = 0.05) {
            // Create a temporary element to compute the color
            const temp = document.createElement('div');
            temp.style.color = color;
            document.body.appendChild(temp);

            // Get computed color
            const computedColor = window.getComputedStyle(temp).color;
            document.body.removeChild(temp);

            // Parse RGB values
            const match = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (match) {
                return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
            }

            // If color parsing fails, return a default transparent background
            return `rgba(0, 0, 0, ${opacity})`;
        }

        // Check if DVDoomParent exists, if not, create it
        let dvDoomParent = document.getElementById("DVDoomParent");
        if (!dvDoomParent) {
            dvDoomParent = document.createElement('div');
            dvDoomParent.id = "DVDoomParent";
            dvDoomParent.style.display = 'flex';
            dvDoomParent.style.marginLeft = '3.5px';
            dvDoomParent.style.marginRight = '12.5px';
            dvDoomParent.style.justifyContent = 'space-between';

            // Find an appropriate place to insert DVDoomParent
            let targetElement = document.querySelector('#threadList, .navLinks.desktop');
            if (targetElement) {
                targetElement.parentNode.insertBefore(dvDoomParent, targetElement);
            } else {
                document.body.appendChild(dvDoomParent);
            }
            // Adding a horizontal rule below the parent div if needed
            dvDoomParent.insertAdjacentHTML('afterend', '<hr/>');
        }

        // Set up DOM elements
        const fragment = document.createDocumentFragment();
        const seiaEnclosure = document.createElement('div');
        seiaEnclosure.id = 'seiaEnclosure';
        fragment.appendChild(seiaEnclosure);
        const threadElement = document.querySelector(".navLinks.desktop, #threadList");
        threadElement.parentNode.insertBefore(fragment, threadElement);

        // Set up observers for both html and body elements
        const observers = [];

        function setupBackgroundObservers(drawer) {
            // Observer for html element
            const htmlObserver = new MutationObserver(() => {
                copyBodyBackground(drawer);
            });

            htmlObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            // Observer for body element
            const bodyObserver = new MutationObserver(() => {
                copyBodyBackground(drawer);
            });

            bodyObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            observers.push(htmlObserver, bodyObserver);

            // Also update on system color scheme changes
            const colorSchemeObserver = window.matchMedia('(prefers-color-scheme: dark)');
            colorSchemeObserver.addListener(() => {
                copyBodyBackground(drawer);
            });
        }

        // Initial setup
        copyBodyBackground(drawer);
        setupBackgroundObservers(drawer);


        // Constants
        const DEFAULT_SIZE = 75;
        const DEFAULT_SPEED = 2;
        const MAX_TRAIL_LENGTH = 25;

        // Dynamic window size handling
        let screenWidth = window.innerWidth;
        let screenHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            screenWidth = window.innerWidth;
            screenHeight = window.innerHeight;
        });

        // End of Service flag
        let EOS = false;

        // Seia management
        const SEIA_TYPE_MAP = new Map();
        const SEIA_STRING_ENUM = {};

        // Function used for integer randomization.
        function randomInt(min, max) {
            return Math.floor(Math.random() * max) + min;
        }

        // Used for image caching.
        const imageURLMap = {
            default: catboxReady('https://files.catbox.moe/ph1rgd.gif'),
            defaultHearts: catboxReady('https://files.catbox.moe/0nujy7.gif'),
            blush: catboxReady('https://files.catbox.moe/oz1irf.gif'),
            blushHearts: catboxReady('https://files.catbox.moe/h6qcnz.gif'),
            shiny: catboxReady('https://files.catbox.moe/p23xa2.gif'),
            hole: catboxReady('https://files.catbox.moe/ri3pe7.png')
        };

        // Preloaded images will be stored here
        // Maybe we don't even need to use base 64?
        const imageCache = {};

        //////////////
        /// Seia collision logic
        const COORDINATE_LENGTH = 500;
        const SEIA_COORDINATE_MAP = [];
        const CoordinatesListItem = (superclass) => class CoordinatesListItem extends superclass {
            constructor(...args) {
                super(...args);
                this.currentCoordinate = Math.floor(this.positionY / COORDINATE_LENGTH);
                const currentHead = SEIA_COORDINATE_MAP[this.currentCoordinate];
                if (currentHead) {
                    currentHead.prev = this;
                    this.next = currentHead;
                }
                SEIA_COORDINATE_MAP[this.currentCoordinate] = this;
                this.prev = null;
            }

            get mass() {
                var density = 1;
                return density * this.elementSize * this.elementSize;
            }

            get v() {
                return [this.directionX, this.directionY];
            }

            dettach() {
                const currentHead = SEIA_COORDINATE_MAP[this.currentCoordinate];
                const nextNode = this.next;
                const prevNode = this.prev;
                this.next = null;
                this.prev = null;
                if (currentHead === this) SEIA_COORDINATE_MAP[this.currentCoordinate] = nextNode;
                if (nextNode) nextNode.prev = prevNode;
                if (prevNode) prevNode.next = nextNode;
            }

            attach() {
                const currentHead = SEIA_COORDINATE_MAP[this.currentCoordinate];
                if (currentHead) {
                    currentHead.prev = this;
                    this.next = currentHead;
                }
                SEIA_COORDINATE_MAP[this.currentCoordinate] = this;
                this.prev = null;
            }

            updateCoordinatePosition() {
                // Obtain the next coordinate.
                const nextCoordinate = Math.floor(this.positionY / COORDINATE_LENGTH);
                // Check if it has changed.
                if ((nextCoordinate != this.currentCoordinate) && (nextCoordinate >= 0)) {
                    // console.log("Changing " + this.id);
                    this.dettach();
                    this.currentCoordinate = nextCoordinate;
                    this.attach();
                }
            }

            collision(seiaStart) {
                let other = seiaStart;
                while (other) {
                    var dx = this.positionX - other.positionX;
                    var dy = this.positionY - other.positionY;
                    if (Math.sqrt(dx * dx + dy * dy) < ((this.elementSize / 2) + (other.elementSize / 2))) {
                        var res = [this.directionX - other.directionX, this.directionY - other.directionY];
                        if (res[0] * (other.positionX - this.positionX) + res[1] * (other.positionY - this.positionY) >= 0) {
                            var m1 = this.mass
                            var m2 = other.mass
                            var theta = -Math.atan2(other.positionY - this.positionY, other.positionX - this.positionX);
                            var v1 = rotate(this.v, theta);
                            var v2 = rotate(other.v, theta);
                            var u1 = rotate([v1[0] * (m1 - m2) / (m1 + m2) + v2[0] * 2 * m2 / (m1 + m2), v1[1]], -theta);
                            var u2 = rotate([v2[0] * (m2 - m1) / (m1 + m2) + v1[0] * 2 * m1 / (m1 + m2), v2[1]], -theta);


                            this.directionX = u1[0];
                            this.directionY = u1[1];
                            this.facing = (this.directionX > 0 ? 1 : -1);
                            other.directionX = u2[0];
                            other.directionY = u2[1];
                            other.facing = (other.directionX > 0 ? 1 : -1);

                            if (this.hue !== null) {
                                if (other.hue === null) {
                                    other.hue = this.hue;
                                } else if (this.hue !== other.hue) {
                                    other.hue = this.hue = null;
                                }
                            } else {
                                if (other.hue !== null) {
                                    this.hue = other.hue;
                                }
                            }

                            this.syncUI();
                            other.syncUI();
                        }
                    }
                    other = other.next;
                }
            }

            // Method to destroy a DVDoom instance.
            destroy() {
                // Remove the element.
                this.dettach();
                // Continue the removal.
                super.destroy();
            }
        }

        const IMAGE_BG_PREFIX = 'seia-imagebg-';

        async function preloadImages() {
            const loadImageAsBase64 = function() {
                if (window.location.hostname === "4chan.org") {
                    return async (url) => {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        return new Promise((resolve) => {
                            resolve(window.URL.createObjectURL(blob));
                        });
                    };
                } else {
                    return async (url) => {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    };
                }
            }();

            for (const [key, url] of Object.entries(imageURLMap)) {
                GM_addStyle(`
                    .${IMAGE_BG_PREFIX}${key} {
                        background-image: url(${await loadImageAsBase64(url)}) !important;
                    }
                `);
                imageCache[key] = `${IMAGE_BG_PREFIX}${key}`;
            }
        }

        // Ensure images are preloaded before continuing
        await preloadImages();

        // Mouse position tracking
        function debounce(func, wait) {
            let timeout;
            return function () {
                const context = this,
                    args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), wait);
            };
        }

        const mousePos = {
            x: 0,
            y: 0
        };
        document.addEventListener('mousemove', (event) => {
            mousePos.x = event.clientX;
            mousePos.y = event.clientY;
        });

        function checkCollisions(seiaArray) {
            for (let i = 0; i < seiaArray.length; i++) {
                for (let j = i + 1; j < seiaArray.length; j++) {
                    const seia1 = seiaArray[i];
                    const seia2 = seiaArray[j];

                    if (seia1.isHeld || seia2.isHeld || seia1.type === 'game' || seia2.type === 'game') {
                        continue;
                    }

                    const dx = seia2.positionX - seia1.positionX;
                    const dy = seia2.positionY - seia1.positionY;
                    const distanceSquared = dx * dx + dy * dy;
                    const minDist = seia1.elementSize / 2 + seia2.elementSize / 2;
                    const minDistSquared = minDist * minDist;

                    if (distanceSquared < minDistSquared) {
                        const distance = Math.sqrt(distanceSquared); // Calculate sqrt only if there's a collision
                        const overlap = minDist - distance;
                        const nx = dx / distance;
                        const ny = dy / distance;

                        const separation = overlap / 10;
                        const sx = nx * separation;
                        const sy = ny * separation;

                        seia1.positionX -= sx / 2;
                        seia1.positionY -= sy / 2;
                        seia2.positionX += sx / 2;
                        seia2.positionY += sy / 2;

                        const v1 = {
                            x: seia1.directionX,
                            y: seia1.directionY
                        };
                        const v2 = {
                            x: seia2.directionX,
                            y: seia2.directionY
                        };

                        seia1.directionX = v2.x;
                        seia1.directionY = v2.y;
                        seia2.directionX = v1.x;
                        seia2.directionY = v1.y;

                        seia1.syncUI();
                        seia2.syncUI();
                    }
                }
            }
        }

        /**
         * Rotates a point or velocity vector around the origin.
         * @param {number} x The x-coordinate of the point/vector to rotate.
         * @param {number} y The y-coordinate of the point/vector to rotate.
         * @param {number} sin The precomputed sine of the angle to rotate.
         * @param {number} cos The precomputed cosine of the angle to rotate.
         * @param {boolean} reverse If true, rotates counterclockwise; otherwise, clockwise.
         * @returns {{x: number, y: number}} The rotated point/vector.
         */

        // So, the funny thing is I declared this but never read it anywhere.
        // I'll leave it here in case you have another Seia idea that involes rotation!
        function rotation(x, y, sin, cos, reverse) {
            return {
                x: (reverse) ? (x * cos + y * sin) : (x * cos - y * sin),
                y: (reverse) ? (y * cos - x * sin) : (y * cos + x * sin)
            };
        }


        function rotate(v, theta) {
            return [v[0] * Math.cos(theta) - v[1] * Math.sin(theta), v[0] * Math.sin(theta) + v[1] * Math.cos(theta)];
        }


        // Use a function to set multiple styles at once to reduce layout thrashing
        const setStyles = (elem, styles, ...classes) => {
            /*
            if (styles.background || styles.backgroundImage) {
                let id = styles.background || styles.backgroundImage;
                id = id.substring(5, id.length - 2);

                delete styles.background;
                delete styles.backgroundImage;

                if (elem.attributes.imagebg !== id) {
                    if (elem.attributes.imagebg) elem.classList.remove(IMAGE_BG_PREFIX + elem.attributes.imagebg);
                    elem.classList.add(IMAGE_BG_PREFIX + id);
                    elem.attributes.imagebg = id;
                }
            }
            */
            Object.assign(elem.style, styles);
            elem.classList.add(...classes);
        };


        ////////////////////////////////////////////////////
        /////////////////// SEIA CLASSES ///////////////////
        ////////////////////////////////////////////////////

        //////////////////// Base

        // Base class to be extended by every type of Seia.
        class DVDoom {
            constructor(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing, type) {
                // Base UI fields.
                this.elementSize = elementSize;
                this.positionX = positionX;
                this.positionY = positionY;
                this.hue = hue;
                this.background = background;
                this.facing = facing;
                // Movement fields.
                this.directionX = directionX;
                this.directionY = directionY;
                this.maxSpeed = speed;
                this.speed = speed;
                // Other fields.
                this.eos = false;

                this.type = type;
                this.collisionCooldown = 0;

                // Setup of the DVDoom's UI view.
                this.htmlElement = document.createElement('div');
                this.htmlElement.className = 'doomvdoom';
                let filterType = (hue === null) ? `grayscale(1)` : `hue-rotate(${hue}deg)`;
                setStyles(this.htmlElement, {
                    transform: `scaleX(${facing})`,
                    position: 'absolute',
                    left: `${positionX}px`,
                    top: `${positionY}px`,
                    height: `${elementSize}px`,
                    width: `${elementSize}px`,
                    filter: filterType,
                    pointerEvents: 'none',
                    backgroundSize: 'cover',
                    maskMode: 'luminance'
                }, background);
            }

            triggerCollisionCooldown(frames) {
                this.collisionCooldown = frames;
            }

            // Reflect changes in the DVDoom instance to the UI.
            syncUI() {
                if (this.collisionCooldown > 0) {
                    this.collisionCooldown--; // Decrement cooldown timer
                    return; // Skip movement if cooling down
                }
                this.htmlElement.style.left = `${this.positionX}px`;
                this.htmlElement.style.top = `${this.positionY}px`;
            }

            // Method to adjust a DVDoom instance per tick.
            adjust() {
                // Return true.
                return true;
            }

            // Method to destroy a DVDoom instance.
            destroy() {
                // Remove the element.
                this.htmlElement.remove();
                // Ensure the element was marked for deletion.
                this.eos = true;
            }

            // Factory method to create a DVDoom instance, implementation should be provided based on specific use case.
            static create() {
                return null;
            }

            // Method to handle same class collisions.
            static handleCollisions() {
            }
        }

        //////////////////// Mixins

        // Class containing all cursor reaction logic, by extending this class a Seia is able to interact with the cursor.
        class DVDoomCursorMixin extends DVDoom {

            constructor(...args) {
                // Ensure the upper class is properly set up.
                super(...args);

                // Mouse related variables.
                this.launchCooldown = 0;
                this.mouseCollisionCooldown = 0;
                this.isDragging = false;
                this.velocityX = 0;
                this.velocityY = 0;
                this.isHeld = false;

                // Create the listeners functions.
                this.boundMouseDown = this.handleMouseDown.bind(this);
                this.boundMouseMove = this.handleMouseMove.bind(this);
                this.boundMouseUp = this.handleMouseUp.bind(this);
                // Add all necessary listeners.
                this.htmlElement.addEventListener('mousedown', this.boundMouseDown);

                // Set the element style.
                setStyles(this.htmlElement, {
                    pointerEvents: 'auto',
                });
            }

            handleMouseDown(event) {
                if (event.target === this.htmlElement) {
                    this.isDragging = true;
                    this.isHeld = true;
                    this.directionX = 0;
                    this.directionY = 0;
                    this.dragStartX = event.clientX;
                    this.dragStartY = event.clientY;
                    document.addEventListener('mousemove', this.boundMouseMove);
                    document.addEventListener('mouseup', this.boundMouseUp);
                }
            }

            handleMouseMove(event) {
                if (this.isDragging) {
                    let deltaX = event.clientX - this.dragStartX;
                    let deltaY = event.clientY - this.dragStartY;

                    // Update position and velocities
                    this.positionX += deltaX;
                    this.positionY += deltaY;
                    this.velocityX = deltaX;
                    this.velocityY = deltaY;
                    this.syncUI();

                    // Reset drag start positions for next calculation
                    this.dragStartX = event.clientX;
                    this.dragStartY = event.clientY;
                }
            }

            handleMouseUp() {
                this.isDragging = false;
                this.isHeld = false;
                this.launchSeia(this.velocityX, this.velocityY);
                // Remove mouse event listeners when not dragging
                document.removeEventListener('mousemove', this.boundMouseMove);
                document.removeEventListener('mouseup', this.boundMouseUp);
            }

            // Might way to have it gradually lose speed at some point
            // But for now let's have fun with it
            launchSeia(deltaX, deltaY) {
                // Use a constant threshold for 'significant' drag
                const significantDragThreshold = 10;
                const dragNumber = Math.hypot(deltaX, deltaY);
                if (dragNumber < significantDragThreshold) {
                    return; // Ignore insignificant drags
                }
                // Launch the seia by updating its direction
                this.directionX = deltaX / dragNumber;
                this.directionY = deltaY / dragNumber;
                this.speed = dragNumber / significantDragThreshold;
                // Set cooldowns to avoid immediate re-collision
                this.launchCooldown = 30;
                this.mouseCollisionCooldown = 60;
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Skip adjustments if the seia is held or cooldowns are active
                if (this.isHeld) return false;
                if (this.launchCooldown > 0 || this.mouseCollisionCooldown > 0) {
                    this.launchCooldown--;
                    this.mouseCollisionCooldown--;
                }

                if (this.mouseCollisionCooldown == 0 && this.type !== 'game') {
                    const dx = mousePos.x - (this.positionX + this.elementSize / 2);
                    const dy = (mousePos.y + window.scrollY) - (this.positionY + this.elementSize / 2);
                    const distanceSquared = dx * dx + dy * dy;
                    const collisionRadiusSquared = Math.max(100, (this.elementSize / 2) * (this.elementSize / 2)); // Compare with the square of the collision radius

                    if (distanceSquared < collisionRadiusSquared) {
                        const collisionRadius = Math.sqrt(collisionRadiusSquared); // Calculate sqrt only if needed
                        this.directionX = -dx / collisionRadius;
                        this.directionY = -dy / collisionRadius;
                        this.mouseCollisionCooldown = 60; // Reset cooldown to prevent immediate re-collision
                        return false;
                    }
                }

                if (this.speed > this.maxSpeed) {
                    this.speed *= 0.99;
                }
                return true;
            }

            destroy() {
                // Remove all listeners.
                document.removeEventListener('mousedown', this.boundMouseDown);
                // Continue its deconstruction.
                super.destroy()
            }
        }

        // Class containing all cursor reaction logic, by extending this class a Seia is able to interact with the cursor.
        class DVDoomCursorDragMixin extends DVDoom {

            constructor(...args) {
                // Ensure the upper class is properly set up.
                super(...args);

                // Mouse related variables.
                this.isDragging = false;
                this.velocityX = 0;
                this.velocityY = 0;
                this.isHeld = false;

                // Create the listeners functions.
                this.boundMouseDown = this.handleMouseDown.bind(this);
                this.boundMouseMove = this.handleMouseMove.bind(this);
                this.boundMouseUp = this.handleMouseUp.bind(this);
                // Add all necessary listeners.
                this.htmlElement.addEventListener('mousedown', this.boundMouseDown);

                // Set the element style.
                setStyles(this.htmlElement, {
                    pointerEvents: 'auto',
                });
            }

            handleMouseDown(event) {
                if (event.target === this.htmlElement) {
                    this.isDragging = true;
                    this.isHeld = true;
                    this.directionX = 0;
                    this.directionY = 0;
                    this.dragStartX = event.clientX;
                    this.dragStartY = event.clientY;
                    event.preventDefault();
                    document.addEventListener('mousemove', this.boundMouseMove);
                    document.addEventListener('mouseup', this.boundMouseUp);
                }
            }

            handleMouseMove(event) {
                if (this.isDragging) {
                    let deltaX = (
                        Math.min(Math.max(this.elementSize, event.clientX), (screenWidth - (this.elementSize))) -
                        Math.min(Math.max(this.elementSize, this.dragStartX), (screenWidth - (this.elementSize)))
                    );
                    let deltaY = (
                        Math.min(Math.max(this.elementSize, event.clientY + scrollY), (screenHeight - this.elementSize)) -
                        Math.min(Math.max(this.elementSize, this.dragStartY + scrollY), (screenHeight - this.elementSize))
                    );

                    // Update position and velocities
                    this.positionX += deltaX;
                    this.positionY += deltaY;
                    this.velocityX = deltaX;
                    this.velocityY = deltaY;
                    this.speed += Math.hypot(deltaX, deltaY);
                    this.speed *= 0.9;
                    this.syncUI();

                    // Reset drag start positions for next calculation
                    this.dragStartX = event.clientX;
                    this.dragStartY = event.clientY;
                }
            }

            handleMouseUp() {
                // Remove mouse event listeners when not dragging
                document.removeEventListener('mousemove', this.boundMouseMove);
                document.removeEventListener('mouseup', this.boundMouseUp);
                this.isDragging = false;
                this.isHeld = false;
                this.launchSeia(this.velocityX, this.velocityY);
                this.velocityX = 0;
                this.velocityY = 0;
            }

            // Might way to have it gradually lose speed at some point
            // But for now let's have fun with it
            launchSeia(deltaX, deltaY) {
                // Use a constant threshold for 'significant' drag
                const significantDragThreshold = 10;
                const dragNumber = Math.hypot(deltaX, deltaY);
                if (dragNumber < significantDragThreshold) {
                    this.speed = 0;
                    return; // Ignore insignificant drags
                }
                // Launch the seia by updating its direction
                this.directionX = deltaX / dragNumber;
                this.directionY = deltaY / dragNumber;
                this.facing = this.directionX > 0 ? 1 : -1;
                this.speed /= significantDragThreshold;
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Skip adjustments if the seia is held or cooldowns are active
                if (this.isHeld) return false;

                if (this.speed > this.maxSpeed) {
                    this.speed *= 0.99;
                }
                return true;
            }

            destroy() {
                // Remove all listeners.
                document.removeEventListener('mousedown', this.boundMouseDown);
                // Continue its deconstruction.
                super.destroy()
            }
        }


        //////////////////// Seias

        // Seia => a more erratic version of the classic Seia that can bounce unpredictably with various sizes and speeds.
        class DVDoomRE extends DVDoom {

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Use a helper function to handle the bounce logic
                this.handleBounce();

                // Directly update styles using the setStyles function
                setStyles(this.htmlElement, {
                    left: `${this.positionX}px`,
                    top: `${this.positionY}px`,
                    filter: `hue-rotate(${this.hue}deg)`,
                    transform: `scaleX(${this.facing})`
                });

                return true;
            }

            syncUI() {
                // Call the superclass method is called to update the UI.
                super.syncUI();
                // Update the direction.
                this.htmlElement.style["transform"] = `scaleX(${this.facing})`;
            }

            handleBounce() {
                if (((this.positionY + (this.elementSize * 1.3)) >= screenHeight) && this.directionY > 0) {
                    this.directionY = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * -1;
                    this.directionX = (2 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                    this.hue = Math.floor(Math.random() * 360); // Randomly adjust the hue
                } else if ((this.positionY < 0) && this.directionY < 0) {
                    this.directionY = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * 1;
                    this.directionX = (2 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                    this.hue = Math.floor(Math.random() * 360); // Randomly adjust the hue
                }

                if (((this.positionX + (this.elementSize * 1.3)) >= screenWidth) && this.directionX > 0) {
                    this.directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * -1;
                    this.directionY = (2 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                    this.hue = Math.floor(Math.random() * 360); // Randomly adjust the hue
                    this.facing = -1; // Flip the scaleX value
                } else if ((this.positionX < 0) && this.directionX < 0) {
                    this.directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * 1;
                    this.directionY = (2 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                    this.hue = Math.floor(Math.random() * 360); // Randomly adjust the hue
                    this.facing = 1; // Flip the scaleX value
                }

                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
            }

            static create() {
                // Existing make method implementation
                // As in, I left it untouched because I was starting to spend a significant time trying to "make it better"
                let sizeMultiplier = ((Math.random() * 0.75) + 0.5);
                let elementSize = DEFAULT_SIZE * sizeMultiplier;
                let positionX = Math.floor(Math.random() * ((screenWidth * 0.99) - elementSize));
                let positionY = Math.floor(Math.random() * ((screenHeight * 0.99) - elementSize));
                let directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * ((Math.random() >= 0.5) ? 1 : -1);
                let directionY = (2 - Math.abs(directionX)) * ((Math.random() >= 0.5) ? 1 : -1);
                let speed = DEFAULT_SPEED * (Math.random() + 0.5);
                let hue = Math.floor(Math.random() * 360);
                let facing = (directionX > 0 ? 1 : -1);
                if (Math.random() < 0.001) {
                    let background = imageCache.shiny;
                    return new DVDoomREShiny(elementSize, positionX, positionY, directionX, directionY, speed, 0, background, facing, sizeMultiplier);
                } else {
                    let background = imageCache.default;
                    return new DVDoomRE(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
                }
            }
        }

        // Shiny Seia => a very rare golden version of the normal Seia which emits a golden glow.
        class DVDoomREShiny extends DVDoom {
            constructor(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing, sizeMultiplier) {
                super(elementSize, positionX, positionY, directionX, directionY, speed, 60, background, facing);
                // Set styles using setStyles function for better performance (I hope)
                setStyles(this.htmlElement, {
                    filter: `drop-shadow(0px 0px ${15 * sizeMultiplier}px #ffd000) contrast(130%) brightness(150%)`,
                }, background);
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;
                // Any specific behavior for DVDoomREShiny can go here, if needed
                // Since super.adjust() already handles position updates and bounce logic,
                // we may not need to repeat that logic here unless there's something different
                // for shiny ones. I've left it untouched for this reason.
                if (((this.positionY + (this.elementSize * 1.3)) >= screenHeight) && this.directionY > 0) {
                    this.directionY = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * -1;
                    this.directionX = (2 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                } else if ((this.positionY < 0) && this.directionY < 0) {
                    this.directionY = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * 1;
                    this.directionX = (2 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                }

                if (((this.positionX + (this.elementSize * 1.3)) >= screenWidth) && this.directionX > 0) {
                    this.directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * -1;
                    this.directionY = (2 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                } else if ((this.positionX < 0) && this.directionX < 0) {
                    this.directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * 1;
                    this.directionY = (2 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                }
                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
                return true;
            }

            syncUI() {
                // Call the superclass method is called to update the UI.
                super.syncUI();
                // Update the direction.
                this.htmlElement.style["transform"] = `scaleX(${this.facing})`;
            }
        }

        // Classic Seia => dvd like behavior of the initial version of the script.
        class DVDoomClassic extends DVDoom {
            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                if (
                    (this.positionY + this.elementSize * 1.3 >= screenHeight && this.directionY > 0) ||
                    (this.positionY <= 0 && this.directionY < 0)
                ) {
                    this.directionY *= -1;
                    this.hue = Math.floor(Math.random() * 360);
                }

                if (
                    (this.positionX + this.elementSize * 1.3 >= screenWidth && this.directionX > 0) ||
                    (this.positionX <= 0 && this.directionX < 0)
                ) {
                    this.directionX *= -1;
                    this.hue = Math.floor(Math.random() * 360);
                }
                // Move the element
                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
                return true; // Continue animation
            }

            static create() {
                // This method has a logic error; it should instantiate DVDoomClassic, not DVDoomRE
                // I think. I think? Change it back to RE if that's intentional
                let elementSize = DEFAULT_SIZE;
                let positionX = Math.floor(Math.random() * (screenWidth - elementSize));
                let positionY = Math.floor(Math.random() * (screenHeight - elementSize));
                let directionX = (Math.random() >= 0.5) ? 1 : -1;
                let directionY = (Math.random() >= 0.5) ? 1 : -1;
                let speed = DEFAULT_SPEED;
                let hue = Math.floor(Math.random() * 360);
                let facing = 1;
                let background = imageCache.default;
                // Create a new instance of DVDoomClassic instead of DVDoomRE
                return new DVDoomClassic(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
            }
        }

        // Trailling Seia => a hue shifting seia that leaves behind a trail.
        class DVDoomTrailing extends DVDoomCursorDragMixin {
            constructor(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing) {
                super(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
                this.trail = [];
                this.maxTrailLength = 10;
                this.lastSpawn = 0;
            }

            syncUI() {
                // Call the superclass method is called to update the UI.
                super.syncUI();
                // Update the direction.
                this.htmlElement.style["transform"] = `scaleX(${this.facing})`;
                this.htmlElement.style["filter"] = `hue-rotate(${this.hue}deg)`;
            }

            adjust() {
                // Manage trail spawning
                if (this.lastSpawn > (10 / (this.speed / this.maxSpeed))) {
                    this.spawnTrail();
                    this.lastSpawn = 0;
                } else {
                    this.lastSpawn++;
                }

                // Fade out trail elements over time
                this.fadeTrailElements();

                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Bounce logic for edges
                this.bounceOnEdges();

                // Update position and visual appearance
                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
                this.hue = ((this.hue + 1) % 360);
                return true;
            }

            spawnTrail() {
                let newTrailSeia = new DvDoomAuxStationary(
                    this.elementSize,
                    this.positionX,
                    this.positionY,
                    this.directionX,
                    this.directionY,
                    this.speed,
                    this.hue,
                    this.background,
                    (this.directionX > 0 ? 1 : -1)
                );
                this.trail.push(newTrailSeia);
                seiaEnclosure.insertBefore(newTrailSeia.htmlElement, this.htmlElement);
            }

            fadeTrailElements() {
                for (let index = 0; index < this.trail.length; index++) {
                    let currentTrailElement = this.trail[index].htmlElement;
                    currentTrailElement.style.opacity = (index) / MAX_TRAIL_LENGTH;
                }
                if (this.trail.length > MAX_TRAIL_LENGTH) {
                    this.trail[0].destroy();
                    this.trail.splice(0, 1);
                }
            }

            bounceOnEdges() {
                if (((this.positionY + (this.elementSize * 1.3)) >= screenHeight) && this.directionY > 0) {
                    this.bounce('y', -1);
                } else if ((this.positionY < 0) && this.directionY < 0) {
                    this.bounce('y', 1);
                }

                if (((this.positionX + (this.elementSize * 1.3)) >= screenWidth) && this.directionX > 0) {
                    this.bounce('x', -1);
                } else if ((this.positionX < 0) && this.directionX < 0) {
                    this.bounce('x', 1);
                }
            }

            bounce(axis, direction) {
                if (axis === 'y') {
                    this.directionY = ((Math.random() * 0.8) + 0.2) * direction;
                    this.directionX = (1 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                } else {
                    this.directionX = ((Math.random() * 0.8) + 0.2) * direction;
                    this.directionY = (1 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                    this.facing = (this.directionX > 0) ? 1 : -1;
                }
            }

            destroy() {
                // Empty out the trail.
                this.trail.forEach((seiaTrailElement) => seiaTrailElement.destroy());
                this.trail = [];
                // Continue its deconstruction.
                super.destroy();
            }

            static create() {
                let elementSize = DEFAULT_SIZE;
                let positionX = Math.floor(Math.random() * ((screenWidth * 0.99) - elementSize));
                let positionY = Math.floor(Math.random() * ((screenHeight * 0.99) - elementSize));
                let directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * ((Math.random() >= 0.5) ? 1 : -1);
                let directionY = (2 - Math.abs(directionX)) * ((Math.random() >= 0.5) ? 1 : -1);
                let speed = DEFAULT_SPEED;
                let hue = Math.floor(Math.random() * 360);
                let facing = (directionX > 0 ? 1 : -1);
                let background = imageCache.default;
                return new DVDoomTrailing(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
            }
        }

        // Fractal Seia => a Seia that splits into two smaller Seias upon impact.
        class DVDoomFractal extends DVDoom {

            splitSeia(wallHit) {
                this.eos = true;
                let elementSize = Math.floor(this.elementSize * 0.75);

                if (elementSize < 12) {
                    return;
                }

                const documentfragment = document.createDocumentFragment();
                let directionY1;
                let directionX1;
                let directionY2;
                let directionX2;

                if (wallHit) {
                    directionX1 = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * (this.directionX > 0 ? -1 : 1);
                    directionY1 = (2 - Math.abs(directionX1)) * ((Math.random() >= 0.5) ? 1 : -1);
                    directionX2 = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * (this.directionX > 0 ? -1 : 1);
                    directionY2 = (2 - Math.abs(directionX2)) * ((Math.random() >= 0.5) ? 1 : -1);
                } else {
                    directionY1 = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * (this.directionY > 0 ? -1 : 1);
                    directionX1 = (2 - Math.abs(directionY1)) * ((Math.random() >= 0.5) ? 1 : -1);
                    directionY2 = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * (this.directionY > 0 ? -1 : 1);
                    directionX2 = (2 - Math.abs(directionY2)) * ((Math.random() >= 0.5) ? 1 : -1);
                }

                let positionX1 = this.positionX + (directionX1 * this.speed);
                let positionY1 = this.positionY + (directionY1 * this.speed);
                let positionX2 = this.positionX + (directionX2 * this.speed);
                let positionY2 = this.positionY + (directionY2 * this.speed);

                let childSeia1 = new DVDoomFractal(
                    elementSize,
                    positionX1,
                    positionY1,
                    directionX1,
                    directionY1,
                    this.speed,
                    Math.floor(Math.random() * 360),
                    this.background,
                    (directionX1 > 0 ? 1 : -1)
                );
                SEIA_TYPE_MAP.get(DVDoomFractal).push(childSeia1);
                documentfragment.appendChild(childSeia1.htmlElement);

                let childSeia2 = new DVDoomFractal(
                    elementSize,
                    positionX2,
                    positionY2,
                    directionX2,
                    directionY2,
                    this.speed,
                    Math.floor(Math.random() * 360),
                    this.background,
                    (directionX2 > 0 ? 1 : -1)
                );
                SEIA_TYPE_MAP.get(DVDoomFractal).push(childSeia2);
                documentfragment.appendChild(childSeia2.htmlElement);

                seiaEnclosure.appendChild(documentfragment);
            }

            adjust() {
                if (((this.positionY + (this.elementSize * 1.3)) >= screenHeight) && this.directionY > 0) {
                    this.splitSeia(false);
                    return false;
                } else if ((this.positionY < 0) && this.directionY < 0) {
                    this.splitSeia(false);
                    return false;
                }

                if (((this.positionX + (this.elementSize * 1.3)) >= screenWidth) && this.directionX > 0) {
                    this.splitSeia(true);
                    return false;
                } else if ((this.positionX < 0) && this.directionX < 0) {
                    this.splitSeia(true);
                    return false;
                }
                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
                return true;
            }

            static create() {
                let elementSize = DEFAULT_SIZE * 2.5;
                let positionX = Math.floor(Math.random() * ((screenWidth * 0.99) - elementSize));
                let positionY = Math.floor(Math.random() * ((screenHeight * 0.99) - elementSize));
                let directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * ((Math.random() >= 0.5) ? 1 : -1);
                let directionY = (2 - Math.abs(directionX)) * ((Math.random() >= 0.5) ? 1 : -1);
                let speed = DEFAULT_SPEED;
                let hue = Math.floor(Math.random() * 360);
                let facing = (directionX > 0 ? 1 : -1);
                let background = imageCache.default;
                return new DVDoomFractal(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing, background);
            }
        }

        // Snake (Player) Seia => a Seia that can be controlled through the WASD keys, eats food-type point Seias to grow its tail. Dies on impact with walls or death-type point Seias.
        class DVDoomPlayer extends DVDoom {

            constructor(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing) {
                super(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
                this.trail = [];
                this.maxTrailSize = 0;
                this.lastSpawn = 0;
                this.type = 'game';
                this.customEventListener = (event) => {
                    switch (event.key) {
                        case 'a':
                            if (this.directionX == 0) {
                                this.directionY = 0;
                                this.directionX = -1;
                                this.facing = -1;
                            }
                            break;
                        case 'd':
                            if (this.directionX == 0) {
                                this.directionY = 0;
                                this.directionX = 1;
                                this.facing = 1;
                            }
                            break;
                        case 'w':
                            if (this.directionY == 0) {
                                this.directionX = 0;
                                this.directionY = -1;
                            }
                            break;
                        case 's':
                            if (this.directionY == 0) {
                                this.directionX = 0;
                                this.directionY = 1;
                            }
                            break;
                        default:
                            break;
                    }
                }
                window.addEventListener(
                    "keydown",
                    this.customEventListener,
                    true,
                );
            }

            syncUI() {
                // Call the superclass method is called to update the UI.
                super.syncUI();
                // Update the direction.
                this.htmlElement.style["transform"] = `scaleX(${this.facing})`;
                this.htmlElement.style["-webkit-filter"] = `hue-rotate(${this.hue}deg)`;
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                for (let index = this.trail.length - 4; index > 0; index--) {
                    let currentSeiaHunter = this.trail[index];
                    if (
                        ((this.positionX + (this.elementSize * 0.15)) < (currentSeiaHunter.positionX + currentSeiaHunter.elementSize)) &&
                        ((this.positionX + (this.elementSize * 0.85)) > currentSeiaHunter.positionX) &&
                        ((this.positionY + (this.elementSize * 0.15)) < (currentSeiaHunter.positionY + currentSeiaHunter.elementSize)) &&
                        ((this.positionY + (this.elementSize * 0.85)) > (currentSeiaHunter.positionY))
                    ) {
                        for (let index = this.trail.length - 1; index >= 0; index--) {
                            this.trail[index].destroy();
                            this.trail.splice(index, 1);
                        }
                        this.eos = true;
                        return false;
                    }
                }
                if (
                    (this.positionY + (this.elementSize * 1.3) >= screenHeight) ||
                    (this.positionY < 0) ||
                    (this.positionX + (this.elementSize * 1.3) >= screenWidth) ||
                    (this.positionX < 0)
                ) {
                    for (let index = this.trail.length - 1; index >= 0; index--) {
                        this.trail[index].destroy();
                        this.trail.splice(index, 1);
                    }
                    this.eos = true;
                    return false;
                }
                if (this.lastSpawn > 18 && this.maxTrailSize > 0) {
                    if (this.trail.length === this.maxTrailSize) {
                        this.trail[0].destroy();
                        this.trail.splice(0, 1);
                    }
                    let newTrailSeia = new DvDoomAuxStationary(
                        this.elementSize,
                        this.positionX,
                        this.positionY,
                        this.directionX,
                        this.directionY,
                        this.speed,
                        this.hue,
                        this.background,
                        (this.directionX > 0 ? 1 : -1)
                    );
                    this.trail.push(newTrailSeia);
                    seiaEnclosure.insertBefore(newTrailSeia.htmlElement, this.htmlElement);
                    this.lastSpawn = 0;
                }
                this.hue = ((this.hue + 1) % 360);
                this.lastSpawn += 1;
                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
                this.htmlElement.style.left = this.positionX + "px";
                this.htmlElement.style.top = this.positionY + "px";
                return true;
            }


            destroy() {
                for (let index = this.trail.length - 1; index >= 0; index--) {
                    let currentTrailElement = this.trail[index];
                    currentTrailElement.destroy();
                    this.trail.splice(index, 1);
                }
                window.removeEventListener('keydown', this.customEventListener);
                super.destroy();
            }

            static create() {
                let elementSize = DEFAULT_SIZE * 0.8;
                let positionX = Math.floor(((screenWidth * 0.5) - elementSize));
                let positionY = Math.floor(elementSize * 2);
                let directionX = 0;
                let directionY = 1;
                let speed = DEFAULT_SPEED * 1.5;
                let hue = Math.floor(Math.random() * 360);
                let facing = 1;
                let background = imageCache.shiny;
                return new DVDoomPlayer(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing, background);
            }
        }

        // Snake (Point) Seia => a Seia that can be of three types (none: changes to another type on impact; food: can be eaten by the player; death: will kill the player).
        class DVDoomPlayerPoint extends DVDoom {

            constructor(elementSize, positionX, positionY, directionX, directionY, speed, background, facing) {
                super(elementSize, positionX, positionY, directionX, directionY, speed, null, background, facing);
                this.pointMode = null;
                this.type = 'game';
            }

            syncUI() {
                // Call the superclass method is called to update the UI.
                super.syncUI();
                // Update the direction.
                this.htmlElement.style["transform"] = `scaleX(${this.facing})`;
                this.htmlElement.style["-webkit-filter"] = `hue-rotate(${this.hue}deg)`;
            }

            changeMode() {
                switch ((Math.random() * 3) << 0) {
                    case 2:
                    case 1:
                        this.hue = 60;
                        this.pointMode = true;
                        break;
                    case 0:
                        this.hue = 300;
                        this.pointMode = false;
                        break;
                    default:
                        this.hue = 0;
                        this.pointMode = null;
                        break;
                }
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                let seiaPlayers = SEIA_TYPE_MAP.get(DVDoomPlayer);

                if (this.pointMode != null) {
                    for (let index = seiaPlayers.length - 1; index >= 0; index--) {
                        let currentSeiaHunter = seiaPlayers[index];
                        if (
                            ((this.positionX) < (currentSeiaHunter.positionX + currentSeiaHunter.elementSize)) &&
                            ((this.positionX + (this.elementSize)) > currentSeiaHunter.positionX) &&
                            ((this.positionY) < (currentSeiaHunter.positionY + currentSeiaHunter.elementSize)) &&
                            ((this.positionY + (this.elementSize)) > (currentSeiaHunter.positionY))
                        ) {

                            if (this.pointMode) {
                                currentSeiaHunter.maxTrailSize += 1;
                            } else {
                                currentSeiaHunter.eos = true;
                            }
                            this.eos = true;
                            return false;
                        }
                    }
                }

                if (((this.positionY + (this.elementSize * 1.3)) >= screenHeight) && this.directionY > 0) {
                    this.directionY = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * -1;
                    this.directionX = (2 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                    this.changeMode();
                } else if ((this.positionY < 0) && this.directionY < 0) {
                    this.directionY = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * 1;
                    this.directionX = (2 - Math.abs(this.directionY)) * (this.directionX > 0 ? 1 : -1);
                    this.changeMode();
                }

                if (((this.positionX + (this.elementSize * 1.3)) >= screenWidth) && this.directionX > 0) {
                    this.directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * -1;
                    this.directionY = (2 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                    this.facing = -1;
                    this.changeMode();
                } else if ((this.positionX < 0) && this.directionX < 0) {
                    this.directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * 1;
                    this.directionY = (2 - Math.abs(this.directionX)) * (this.directionY > 0 ? 1 : -1);
                    this.facing = 1;
                    this.changeMode();
                }
                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
                return true;
            }

            static create() {
                let sizeMultiplier = 0.5;
                let elementSize = DEFAULT_SIZE * sizeMultiplier;
                let positionX = Math.floor(Math.random() * ((screenWidth * 0.99) - elementSize));
                let positionY = Math.floor(Math.random() * ((screenHeight * 0.99) - elementSize));
                let directionX = ((Math.random() * 2 * 0.8) + (2 * 0.2)) * ((Math.random() >= 0.5) ? 1 : -1);
                let directionY = (2 - Math.abs(directionX)) * ((Math.random() >= 0.5) ? 1 : -1);
                let speed = DEFAULT_SPEED * (Math.random() * 0.5) + 0.5;
                let facing = (directionX > 0 ? 1 : -1);
                let background = imageCache.shiny;
                return new DVDoomPlayerPoint(elementSize, positionX, positionY, directionX, directionY, speed, background, facing, background);
            }
        }

        // Rain Seia => a Seia that falls from top to bottom, upon impact teleports back to the top.
        class DVDoomRain extends DVDoom {
            constructor(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing, opacity) {
                super(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
                this.opacity = opacity;
                setStyles(this.htmlElement, {
                    width: `${(elementSize * 0.35)}px`,
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    maskMode: 'luminance',
                    opacity: this.opacity
                });
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;
                // Check if it has reached the bottom.
                if (this.positionY + (this.elementSize * 1.3) >= screenHeight && this.directionY > 0) {
                    this.directionY = Math.random() + 1;
                    this.positionY = this.elementSize;
                    this.htmlElement.style["-webkit-filter"] = 'hue-rotate(' + Math.floor(Math.random() * 360) + 'deg)';
                    this.htmlElement.style.transform = 'scaleX(' + (Math.random() > 0.5 ? 1 : -1) + ')';
                    this.speed = DEFAULT_SPEED * (Math.random() + 1);
                }
                this.positionY += this.directionY * this.speed;
                return true;
            }

            static create() {
                const sizeMultiplier = Math.random() * 0.5 + 0.5;
                const elementSize = DEFAULT_SIZE * sizeMultiplier;
                const positionX = Math.floor(Math.random() * (screenWidth - elementSize));
                const positionY = Math.floor(Math.random() * (screenHeight - elementSize));
                const directionY = Math.random() + 1;
                const speed = DEFAULT_SPEED * (Math.random() + 1);
                const hue = Math.floor(Math.random() * 360);
                const facing = Math.random() > 0.5 ? 1 : -1;
                const background = imageCache.shiny;
                const opacity = Math.random() * 0.4 + 0.3;
                return new DVDoomRain(elementSize, positionX, positionY, 0, directionY, speed, hue, background, facing, opacity);
            }
        }

        // Wife Seia => a Seia that moves towards the cursor.
        class DVDoomWife extends DVDoomCursorDragMixin {
            constructor(...args) {
                super(...args);
                this.chaseSpeed = this.speed;
                this.speed = 0;
                this.directionChaseX = this.directionX;
                this.directionChaseY = this.directionY;
                this.heightModifier = 100;
                this.currentCursorX = mousePos.x;
                this.currentCursorY = mousePos.y;
                this.currentClicks = 0;
                this.doomChildren = [];
                setStyles(this.htmlElement, {
                    // filter: `drop-shadow(0px 0px ${5}px rgba(235, 52, 210, 0.4))`,
                    backgroundSize: `100% ${this.heightModifier}%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'bottom',
                });


                // Uselful for the "return" reaction.
                this.windowVisibilityChange = this.onVisibilityChanged.bind(this);
                this.leftPageDate = -1;
                var eventName;
                this.isVisible = true;
                if ((this.propName = "hidden") in document) eventName = "visibilitychange";
                else if ((this.propName = "msHidden") in document) eventName = "msvisibilitychange";
                else if ((this.propName = "mozHidden") in document) eventName = "mozvisibilitychange";
                else if ((this.propName = "webkitHidden") in document) eventName = "webkitvisibilitychange";
                if (eventName) document.addEventListener(eventName, this.windowVisibilityChange);
                if ("onfocusin" in document) document.onfocusin = document.onfocusout = this.windowVisibilityChange; //IE 9
                window.onpageshow = window.onpagehide = window.onfocus = window.onblur = this.windowVisibilityChange; // Changing tab with alt+tab
                if (document[this.propName] !== undefined) this.windowVisibilityChange({
                    type: document[this.propName] ? "blur" : "focus"
                });

                // Setup of the Seia's text box.
                this.seiaText = '';
                this.textLifetime = 0;
                this.htmlElementText = document.createElement('a');
                this.htmlElementText.className = 'seia-text';
                this.htmlElementText.textContent = this.seiaText;
                setStyles(this.htmlElementText, {
                    display: 'block',
                    whiteSpace: 'pre-line',
                    width: `${this.elementSize * 3}px`,
                    height: `${this.elementSize * 0.5}px`,
                    textAlign: "center",
                    marginLeft: `${this.elementSize * -1}px`,
                    marginTop: `${this.elementSize * -0.25}px`,
                    pointerEvents: 'none'
                });
                this.htmlElement.append(this.htmlElementText);
            }

            onVisibilityChanged(event) {
                event = event || window.event;
                if (this.isVisible && (["blur", "focusout", "pagehide"].includes(event.type) || (document && document[this.propName]))) {
                    this.isVisible = false;
                    this.leftPageDate = performance.now();
                } else if (!this.isVisible && (["focus", "focusin", "pageshow"].includes(event.type) || (document && !document[this.propName]))) {
                    this.isVisible = true;
                    // Check if enough time has passed.
                    if (this.leftPageDate >= 0 && (performance.now() > (this.leftPageDate + (5 * 60 * 1000)))) {
                        this.seiaText = 'you came back';
                        this.textLifetime = 200;
                    }
                    this.leftPageDate = -1;
                }
            }

            syncUI() {
                super.syncUI();
                setStyles(this.htmlElement, {
                    transform: `scaleX(${this.facing})`,
                    backgroundSize: `100% ${this.heightModifier}%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'bottom',
                }, this.background);
                this.htmlElementText.textContent = this.seiaText;
                setStyles(this.htmlElementText, {
                    transform: `scaleX(${this.facing})`,
                    display: ((this.textLifetime > 0) ? 'block' : 'none')
                });
                this.doomChildren.forEach((doomChild) => doomChild.syncUI());
            }

            handleMouseDown(event) {
                super.handleMouseDown(event);
                this.heightModifier = 85;
                this.heartPat();
            }

            adjust() {

                if (this.heightModifier < 100) {
                    this.heightModifier += 1;
                } else {
                    this.currentClicks = 0;
                    this.background = imageCache.defaultHearts;
                }

                if (this.textLifetime === 0) {
                    this.seiaText = '';
                } else {
                    this.textLifetime -= 1;
                }

                // Get the current date.
                const currentUTCDate = new Date();
                if (currentUTCDate.getUTCHours() == 19 && 0 == currentUTCDate.getUTCMinutes() == currentUTCDate.getUTCSeconds()) {
                    this.seiaText = 'reset seia'
                    this.textLifetime = 200;
                }

                // Adjust the child seias.
                for (let i = 0; i < this.doomChildren.length; i++) {
                    const seia1 = this.doomChildren[i];
                    for (let j = i + 1; j < this.doomChildren.length; j++) {
                        const seia2 = this.doomChildren[j];

                        if (seia1.isHeld || seia2.isHeld) {
                            continue;
                        }

                        const dx = (seia2.positionX + (seia2.elementSize / 2)) - (seia1.positionX + (seia1.elementSize / 2));
                        const dy = (seia2.positionY + (seia2.elementSize / 2)) - (seia1.positionY + (seia1.elementSize / 2));
                        const distanceSquared = dx * dx + dy * dy;
                        const minDist = (seia1.elementSize / 2 + seia2.elementSize / 2) * 1.5;
                        const minDistSquared = minDist * minDist;

                        if (distanceSquared < minDistSquared) {
                            const distance = Math.sqrt(distanceSquared); // Calculate sqrt only if there's a collision
                            const overlap = minDist - distance;
                            const nx = dx / distance;
                            const ny = dy / distance;

                            const separation = overlap / 10;
                            const sx = nx * separation;
                            const sy = ny * separation;

                            seia1.positionX -= sx / 2;
                            seia1.positionY -= sy / 2;
                            seia2.positionX += sx / 2;
                            seia2.positionY += sy / 2;

                            const v1 = {
                                x: seia1.directionX,
                                y: seia1.directionY
                            };
                            const v2 = {
                                x: seia2.directionX,
                                y: seia2.directionY
                            };

                            seia1.directionX = v2.x;
                            seia1.directionY = v2.y;
                            seia2.directionX = v1.x;
                            seia2.directionY = v1.y;
                        }
                    }
                    seia1.adjust();
                }

                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Use a helper function to handle the bounce logic
                this.handleBounce();

                const dx = mousePos.x - (this.positionX + this.elementSize / 2);
                const dy = (mousePos.y + window.scrollY) - (this.positionY + this.elementSize / 2);
                const dxy = Math.hypot(dx, dy);

                if (dxy > (this.elementSize * 1.5)) {
                    this.directionChaseX = dx / dxy;
                    this.directionChaseY = dy / dxy;
                    this.chaseSpeed = (dxy / (this.elementSize * 1.5));
                    if (this.speed < (this.maxSpeed * 1.1)) {
                        this.speed = 0;
                        this.positionX += this.directionChaseX * this.chaseSpeed;
                        this.positionY += this.directionChaseY * this.chaseSpeed;
                        this.facing = (this.directionChaseX > 0 ? 1 : -1);
                        return false;
                    }
                }

                if (this.speed > 0) {
                    this.positionX += this.directionX * this.speed;
                    this.positionY += this.directionY * this.speed;
                    this.facing = (this.directionX > 0 ? 1 : -1);
                }

                return true;
            }

            heartPat() {
                this.currentClicks += 1;
                this.background = imageCache.blushHearts;

                if (this.currentClicks > 12) {
                    // Reset the clicks.
                    this.currentClicks = 0;
                    this.createChild();
                }

                var c = document.createDocumentFragment();
                var cc = document.createElement("div");
                for (var i = 0; i < 3; i++) {
                    var e = document.createElement("i");
                    e.className = 'seia-heart';
                    setStyles(e, {
                        width: '15px',
                        left: `${(this.facing > 0 ? (mousePos.x - this.positionX - 7.5) : -(mousePos.x - this.positionX - this.elementSize + 7.5))}px`,
                        top: `${(mousePos.y + window.scrollY) - this.positionY - 7.5}px`,
                        transform: `translate3d(${randomInt(-75, 125)}px, ${randomInt(-80, 80)}px, 0) rotate(${randomInt(-20, 20)}deg)`,
                        animation: `seia-heart-animation 1000ms ease-out forwards`,
                        opacity: 0,
                        position: `absolute`,
                        overflow: `visible`,
                        pointerEvents: 'none'
                    })
                    cc.appendChild(e);
                }
                // document.body.appendChild(c);
                c.append(cc);
                this.htmlElement.append(c);
                setTimeout(() => cc.remove(), 1100);
            }

            createChild() {
                let elementSize = DEFAULT_SIZE * 0.6;
                let directionX = (Math.random() >= 0.5) ? 1 : -1;
                let directionY = (Math.random() >= 0.5) ? 1 : -1;
                let speed = DEFAULT_SPEED * 0.75;
                let facing = 1;
                let background = imageCache.defaultHearts;
                const doomChild = new DVDoomWifeChild(this, elementSize, this.positionX, this.positionY, directionX, directionY, speed, 0, background, facing);
                // Add the doomchild.
                this.doomChildren.push(doomChild);
                seiaEnclosure.insertBefore(doomChild.htmlElement, this.htmlElement);
                // SEIA_TYPE_MAP.get(DVDoomWifeChild).push(doomChild);
            }

            handleBounce() {
                const nextPosY = this.positionY + (this.elementSize * 1.3);
                const nextPosX = this.positionX + (this.elementSize * 1.3);

                if ((nextPosY >= screenHeight && this.directionY > 0) || (this.positionY < 0 && this.directionY < 0)) {
                    this.directionY *= -1;
                }

                if ((nextPosX >= screenWidth && this.directionX > 0) || (this.positionX < 0 && this.directionX < 0)) {
                    this.directionX *= -1;
                }
            }

            destroy() {
                try {
                    document.removeEventListener('visibilitychange', this.windowVisibilityChange);
                } catch {
                }
                ;
                this.doomChildren.forEach((doomChild) => doomChild.destroy());
                super.destroy();
            }

            static create() {
                let elementSize = DEFAULT_SIZE;
                let directionX = (Math.random() >= 0.5) ? 1 : -1;
                let directionY = (Math.random() >= 0.5) ? 1 : -1;
                let speed = DEFAULT_SPEED;
                let facing = 1;
                let background = imageCache.defaultHearts;
                return new DVDoomWife(elementSize, mousePos.x, mousePos.y, directionX, directionY, speed, 0, background, facing);
            }
        }

        // Wife Seia's (Child) => a Seia that moves towards the Seia (Wife).
        class DVDoomWifeChild extends DVDoomCursorDragMixin {
            constructor(parentSeia, ...args) {
                super(...args);
                this.parentSeia = parentSeia;
                this.chaseSpeed = 0;
                this.speed = this.speed * 2;
                this.directionChaseX = this.directionX;
                this.directionChaseY = this.directionY;
                this.heightModifier = 100;
                this.currentCursorX = mousePos.x;
                this.currentCursorY = mousePos.y;
                this.currentClicks = 0;
                setStyles(this.htmlElement, {
                    backgroundSize: `100% ${this.heightModifier}%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'bottom',
                });

            }

            syncUI() {
                super.syncUI();
                setStyles(this.htmlElement, {
                    transform: `scaleX(${this.facing})`,
                    backgroundSize: `100% ${this.heightModifier}%`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'bottom',
                }, this.background);
            }

            handleMouseDown(event) {
                super.handleMouseDown(event);
                this.heightModifier = 85;
                this.heartPat();
            }

            adjust() {

                if (this.heightModifier < 100) {
                    this.heightModifier += 1;
                } else {
                    this.currentClicks = 0;
                    this.background = imageCache.defaultHearts;
                }

                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Use a helper function to handle the bounce logic
                this.handleBounce();

                const dx = this.parentSeia.positionX + (this.parentSeia.elementSize / 2) - (this.positionX + this.elementSize / 2);
                const dy = this.parentSeia.positionY + (this.parentSeia.elementSize / 2) - (this.positionY + this.elementSize / 2);
                const dxy = Math.hypot(dx, dy);

                if (dxy > (this.elementSize * 3)) {
                    this.directionChaseX = dx / dxy;
                    this.directionChaseY = dy / dxy;
                    this.chaseSpeed = (dxy / (this.elementSize * 1.5));
                    if (this.speed < (this.maxSpeed * 1.1)) {
                        this.speed = 0;
                        this.positionX += this.directionChaseX * this.chaseSpeed;
                        this.positionY += this.directionChaseY * this.chaseSpeed;
                        this.facing = (this.directionChaseX > 0 ? 1 : -1);
                        return false;
                    }
                }

                if (this.speed > 0) {
                    this.positionX += this.directionX * this.speed;
                    this.positionY += this.directionY * this.speed;
                    this.facing = (this.directionX > 0 ? 1 : -1);
                }

                return true;
            }

            heartPat() {
                this.background = imageCache.blushHearts;
            }

            handleBounce() {
                const nextPosY = this.positionY + (this.elementSize * 1.3);
                const nextPosX = this.positionX + (this.elementSize * 1.3);

                if ((nextPosY >= screenHeight && this.directionY > 0) || (this.positionY < 0 && this.directionY < 0)) {
                    this.directionY *= -1;
                }

                if ((nextPosX >= screenWidth && this.directionX > 0) || (this.positionX < 0 && this.directionX < 0)) {
                    this.directionX *= -1;
                }
            }
        }

        // Seia (Canvas) => Colored or Uncolored Seias, when a seia with color clashes with a colorless, the colorless becomes colored, when opposite colors clash they both become colorless.
        class DVDoomCanvas extends CoordinatesListItem(DVDoom) {
            constructor(...args) {
                super(...args);
            }

            adjust() {
                // Call the superclass method, if it returns false, consider the adjustment concluded and return immediatly.
                if (!super.adjust()) return false;

                // Use a helper function to handle the bounce logic
                this.handleBounce();

                // Update the position in the coordinate array.
                this.updateCoordinatePosition();

                return true;
            }

            syncUI() {
                // Call the superclass method is called to update the UI.
                super.syncUI();
                // Directly update styles using the setStyles function.
                setStyles(this.htmlElement, {
                    left: `${this.positionX}px`,
                    top: `${this.positionY}px`,
                    filter: (this.hue === null) ? `grayscale(1)` : `hue-rotate(${this.hue}deg)`,
                    transform: `scaleX(${this.facing})`
                });
            }

            handleBounce() {
                if (
                    (this.positionY + this.elementSize * 1.3 >= screenHeight && this.directionY > 0) ||
                    (this.positionY <= 0 && this.directionY < 0)
                ) {
                    this.directionY *= -1;
                }
                if (
                    (this.positionX + this.elementSize * 1.3 >= screenWidth && this.directionX > 0) ||
                    (this.positionX <= 0 && this.directionX < 0)
                ) {
                    this.directionX *= -1;
                    this.facing = (this.directionX > 0 ? 1 : -1);
                }

                this.positionX += this.directionX * this.speed;
                this.positionY += this.directionY * this.speed;
            }

            static handleCollisions() {
                for (let i = 0; i < SEIA_COORDINATE_MAP.length; i++) {
                    // Obtain the current coordinate.
                    let currentSeia = SEIA_COORDINATE_MAP[i];
                    // Loop until no more seias can be found.
                    while (currentSeia) {
                        currentSeia.collision(currentSeia.next);
                        currentSeia.collision(SEIA_COORDINATE_MAP[i + 1]);
                        currentSeia = currentSeia.next;
                    }
                }
            }

            static create() {
                // Existing make method implementation
                // As in, I left it untouched because I was starting to spend a significant time trying to "make it better"
                let elementSize = DEFAULT_SIZE;
                let positionX = Math.floor(Math.random() * ((screenWidth * 0.99) - elementSize));
                let positionY = Math.floor(Math.random() * ((screenHeight * 0.99) - elementSize));
                let directionX = ((Math.random() * 4 * 0.8) + (2 * 0.2)) * ((Math.random() >= 0.5) ? 1 : -1);
                let directionY = (4 - Math.abs(directionX)) * ((Math.random() >= 0.5) ? 1 : -1);
                let speed = 1;
                let hue = Math.floor(Math.random() * 360);
                let facing = (directionX > 0 ? 1 : -1);
                let background = imageCache.shiny;
                if (Math.random() < 0.05) {
                    return new DVDoomCanvas(elementSize, positionX, positionY, directionX, directionY, speed, hue, background, facing);
                } else {
                    return new DVDoomCanvas(elementSize, positionX, positionY, directionX, directionY, speed, null, background, facing);
                }
            }
        }

        //////////////////// Other

        // Class used for static "ghost" Seia, mainly used for trails and the like.
        class DvDoomAuxStationary extends DVDoom {
            adjust() {
            }
        }

        ////////////////////////////////////////////////////
        ///////////////// SEIA MAIN LOGIC //////////////////
        ////////////////////////////////////////////////////

        // Changed how it works, and batch updated so it's less resource heavy
        function addNewSeia(seiaCountToAdd, seiaTypeString, clearPrevious) {
            const seiaType = SEIA_STRING_ENUM[seiaTypeString];
            const seiaTypeList = SEIA_TYPE_MAP.get(seiaType);

            // Clear existing Seias of the same type if specified
            if (clearPrevious) {
                seiaTypeList.forEach(seia => seia.destroy());
                seiaTypeList.length = 0; // Clear the array efficiently
            }

            const documentFragment = new DocumentFragment();
            for (let i = 0; i < seiaCountToAdd; i++) {
                let seia = seiaType.create(); // Create new Seia
                seiaTypeList.push(seia); // Add it to the type list
                documentFragment.appendChild(seia.htmlElement); // Append to the document fragment
            }
            seiaEnclosure.appendChild(documentFragment); // Batch DOM update
        }


        // Here we're going to call this at a lower frame rate so it reduces lag when anons want to have 1k+ Seias on screen
        // Is 60 low these days... I'm getting old
        let fpsInterval = 1000 / 60; // Adjust to 60 FPS
        let lastFrameTime = Date.now();

        function animateSEIAS() {
            window.requestAnimationFrame(animateSEIAS); // Recursively call the animation frame
            screenHeight = document.body.clientHeight;
            screenWidth = document.body.clientWidth;
            let now = Date.now();
            let elapsed = now - lastFrameTime;

            // Flatten the list of all seias just once per animation frame
            const allSeias = [];
            SEIA_TYPE_MAP.forEach(seias => allSeias.push(...seias));

            if (elapsed > fpsInterval) {
                lastFrameTime = now - (elapsed % fpsInterval);
                // Iterate over all Seia types and their lists
                SEIA_TYPE_MAP.forEach((seiaTypeList, seiaType) => {
                    for (let i = seiaTypeList.length - 1; i >= 0; i--) {
                        const seia = seiaTypeList[i];
                        if (!seia.eos) {
                            seia.adjust();
                            if (!seia.eos) {
                                seia.syncUI();
                            } else {
                                seia.destroy(); // Clean up resources
                                seiaTypeList.splice(i, 1); // Remove from list
                            }
                        } else {
                            seia.destroy(); // Clean up resources
                            seiaTypeList.splice(i, 1); // Remove from list
                        }
                    }
                    // Handle collisions.
                    seiaType.handleCollisions();
                });

                // Collision checks
                if (allSeias.length > 1) { // Only perform if there are Seias to check
                    // checkCollisions(allSeias);
                }

                // Check End of Service flag
                // Let's call it tha- Nyo! It's EoS "End of Service"!
                // I had a FASTER way to do this and a lot more optimized but it messed it up to where it wouldn't work
                // WILL come back to this later
                if (EOS) {
                    for (const [seiaType, seiaTypeList] of SEIA_TYPE_MAP) {
                        for (let index = seiaTypeList.length - 1; index >= 0; index--) {
                            let currentSeia = seiaTypeList[index];
                            currentSeia.destroy();
                            seiaTypeList.splice(index, 1);
                        }
                    }
                    EOS = false;
                }
            }
        }

        const SEIA_TYPES = [
            DVDoomRE,
            DVDoomClassic,
            DVDoomFractal,
            DVDoomTrailing,
            DVDoomRain,
            DVDoomPlayer,
            DVDoomPlayerPoint,
            DVDoomCanvas,
            DVDoomWife,
        ];

        SEIA_TYPES.forEach(seiaType => {
            SEIA_TYPE_MAP.set(seiaType, []); // Initialize the map with an empty array for each type
            SEIA_STRING_ENUM[seiaType.name] = seiaType; // Map the class name to the class constructor
        });

        //////////////////////////////////////////////////
        // DVD Seia Menu UI
        //

        // Class containing the seia table menu UI logic.
        class SeiaMenuUI {
            static INPUTS = {
                "single": [1],
                "small": [1, 2, 3, 4, 5],
                "medium": [1, 2, 3, 4, 5, 10, 25, 50],
                "large": [1, 2, 3, 4, 5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 1000],
            }

            constructor(name, color, possibleValues, defaultValueIndex) {
                this.steps = possibleValues;
                this.startIndex = defaultValueIndex;
                this.value = this.steps[this.startIndex];
                this.color = color;
                this.name = name;

                this.body = document.createElement("div");
                this.body.className = 'menu-item';

                // Set background color dynamically
                this.body.style.backgroundColor = colorToRGBA(color);

                const header = document.createElement("div");
                header.className = 'menu-item-header';
                header.textContent = this.name;
                header.style.color = color;

                const content = document.createElement("div");
                content.className = 'menu-item-content';

                this.body.appendChild(header);
                this.body.appendChild(content);
                this.contentDiv = content;
            }

            createInput() {
                const parentDiv = document.createElement("div");
                parentDiv.className = 'quantity';

                const input = document.createElement('input');
                input.className = 'quantity__input';
                input.name = 'quantity';
                input.type = 'number';
                input.addEventListener('input', (function () {
                    this.value = input.value;
                }).bind(this));
                let currentIndex = 0;
                input.value = this.value;

                const orderedSteps = this.steps;
                const reversedSteps = [...this.steps].reverse();

                const incrementButton = (function (e) {
                    e.preventDefault();
                    var currentValue = input.value;
                    if (currentValue < orderedSteps[0]) {
                        currentIndex = 0;
                    } else if (currentValue !== orderedSteps[currentIndex]) {
                        var index = orderedSteps.findIndex(function (number) {
                            return number > currentValue;
                        });
                        currentIndex = (index > 0) ? index : orderedSteps.length - 1;
                    } else if (currentIndex < orderedSteps.length) {
                        currentIndex++;
                    } else {
                        currentIndex = orderedSteps.length - 1;
                    }
                    input.value = orderedSteps[currentIndex];
                    this.value = input.value;
                }).bind(this);

                const decrementButton = (function (e) {
                    e.preventDefault();
                    var currentValue = parseInt(input.value, 10);
                    if (currentValue > orderedSteps[orderedSteps.length - 1]) {
                        currentIndex = orderedSteps.length - 1;
                    } else if (currentValue !== orderedSteps[currentIndex]) {
                        var index = reversedSteps.findIndex(function (number) {
                            return number < currentValue;
                        });
                        currentIndex = (index > 0) ? (orderedSteps.length - index - 1) : 0;
                    } else if (currentIndex > 0) {
                        currentIndex -= 1;
                    } else {
                        currentIndex = 0;
                    }
                    input.value = orderedSteps[currentIndex];
                    this.value = input.value;
                }).bind(this);

                const buttonMinus = document.createElement('a');
                buttonMinus.className = 'quantity__minus';
                buttonMinus.onclick = decrementButton;
                buttonMinus.innerHTML = '<span>-</span>';

                const buttonPlus = document.createElement('a');
                buttonPlus.className = 'quantity__plus';
                buttonPlus.onclick = incrementButton;
                buttonPlus.innerHTML = '<span>+</span>';

                parentDiv.appendChild(buttonMinus);
                parentDiv.appendChild(input);
                parentDiv.appendChild(buttonPlus);

                this.contentDiv.appendChild(parentDiv);
                return this;
            }

            createButton(buttonText, buttonTitle, buttonAction) {
                const buttonElement = document.createElement("button");
                buttonElement.textContent = buttonText;
                buttonElement.onclick = () => buttonAction(this.value);
                buttonElement.className = 'dvdoom-button';
                buttonElement.title = buttonTitle;
                buttonElement.style.color = this.color;

                this.contentDiv.appendChild(buttonElement);
                return this;
            }

            make() {
                return this.body;
            }

        }

        // List of seia cells in the table.
        const seiaGridMap = [
            [
                new SeiaMenuUI('Seia', 'red', SeiaMenuUI.INPUTS.large, 9).createInput().createButton('Spawn', 'Add Seia', (n) => addNewSeia(n, 'DVDoomRE')).make(),
                new SeiaMenuUI('Seia (Classic)', 'limegreen', SeiaMenuUI.INPUTS.large, 9).createInput().createButton('Spawn', 'Add Classic Seia', (n) => addNewSeia(n, 'DVDoomClassic')).make(),
                new SeiaMenuUI('Seia (Fractal)', 'blue', SeiaMenuUI.INPUTS.small, 0).createInput().createButton('Spawn', 'Add Fractal Seia', (n) => addNewSeia(n, 'DVDoomFractal')).make(),
                new SeiaMenuUI('Seia (Trailing)', 'sandybrown', SeiaMenuUI.INPUTS.medium, 2).createInput().createButton('Spawn', 'Add Trailing Seia', (n) => addNewSeia(n, 'DVDoomTrailing')).make(),
            ],
            [
                new SeiaMenuUI('Seia (Rain)', 'cornflowerblue', SeiaMenuUI.INPUTS.large, 9).createInput().createButton('Spawn', 'Add Rain Seia', (n) => addNewSeia(n, 'DVDoomRain')).make(),
                new SeiaMenuUI('Seia (Game)', 'indigo', SeiaMenuUI.INPUTS.large, 9).createInput().createButton('Spawn', 'Add game point Seia', (n) => addNewSeia(n, 'DVDoomPlayerPoint')).createButton('Start', 'Add game player Seia', (n) => addNewSeia(1, 'DVDoomPlayer', true)).make(),
                new SeiaMenuUI('Seia (Canvas)', 'darkturquoise', SeiaMenuUI.INPUTS.large, 9).createInput().createButton('Spawn', 'Add canvas Seia', (n) => addNewSeia(n, 'DVDoomCanvas')).make(),
                new SeiaMenuUI('Seia (Wife)', 'deeppink', SeiaMenuUI.INPUTS.single, 0).createButton('Spawn', 'Span a wife Seia', (n) => addNewSeia(n, 'DVDoomWife', true)).make(),
            ]
        ];


        /*

        // Modify the table creation part
        const tableElement = document.getElementById("seia-table");
        const tableDocumentFragment = document.createDocumentFragment();
        seiaGridMap.forEach((rowUI) => {
            const rowElement = document.createElement('tr');
            rowElement.className = 'dvdoom-row';
            rowUI.forEach((cellUI) => {
                rowElement.appendChild(cellUI);
            });
            tableDocumentFragment.append(rowElement);
        });
        tableElement.appendChild(tableDocumentFragment);

        // Modify the EoS button addition
        tableElement.insertAdjacentHTML('beforeend', `
        <tr>
            <td colspan="4" class="dvdoom-footer" style="padding: 0;">
                <button class="dvdoom-button dvdoom-eos-button" title="End of Session, remove all Seias" onclick="forceEoS()">EoS</button>
            </td>
        </tr>`);

        */

        // Add this function after drawer creation
        function handleDrawerScroll(event) {
            const drawerContent = drawer.querySelector('.drawer-content');
            const scrollTop = drawerContent.scrollTop;
            const scrollHeight = drawerContent.scrollHeight;
            const clientHeight = drawerContent.clientHeight;

            // Check if we're at the top or bottom of the scroll
            const isAtTop = scrollTop === 0;
            const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

            // If we're at the boundaries and trying to scroll further, prevent it
            if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }


        // Modify how the menu items are added
        const drawerContent = drawer.querySelector('.drawer-content');
        seiaGridMap.flat().forEach(menuItem => {
            drawerContent.appendChild(menuItem);
        });
        drawerContent.addEventListener('wheel', handleDrawerScroll, {
            passive: false
        });


        // Handle touch events for mobile
        let touchStartY = 0;
        drawerContent.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].pageY;
        }, {
            passive: true
        });

        drawerContent.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].pageY;
            const scrollTop = drawerContent.scrollTop;
            const scrollHeight = drawerContent.scrollHeight;
            const clientHeight = drawerContent.clientHeight;

            const isAtTop = scrollTop === 0;
            const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

            // Prevent scrolling parent when at scroll boundaries
            if ((isAtTop && touchY > touchStartY) || (isAtBottom && touchY < touchStartY)) {
                e.preventDefault();
            }
        }, {
            passive: false
        });

        // Clean up event listeners when script is unloaded
        window.addEventListener('unload', () => {
            drawerContent.removeEventListener('wheel', handleDrawerScroll);
            observers.forEach(observer => observer.disconnect());
        });

        animateSEIAS();
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// FEED SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        const countdownTimers = {};

        // Add styles for feed table with correct borders
        const feedStyles = `
        .feed-table {
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid #ccc;
            border-radius: 5px;
            overflow: hidden;
        }
        .feed-table th, .feed-table td {
            border-right: 1px solid #ccc;
            border-bottom: 1px solid #ccc;
        }
        .feed-table th:last-child, .feed-table td:last-child {
            border-right: none;
        }
        .feed-table tr:last-child th, .feed-table tr:last-child td {
            border-bottom: none;
        }
        .feed-table tr:first-child th:first-child {
            border-top-left-radius: 5px;
        }
        .feed-table tr:first-child th:last-child {
            border-top-right-radius: 5px;
        }
        .feed-table tr:last-child td:first-child {
            border-bottom-left-radius: 5px;
        }
        .feed-table tr:last-child td:last-child {
            border-bottom-right-radius: 5px;
        }
    `;

        // Add the styles to the document
        const styleElement = document.createElement('style');
        styleElement.textContent = feedStyles;
        document.head.appendChild(styleElement);

        function updateCountdown(feedElementId, countDownDate) {
            return function () {
                const now = new Date().getTime();
                const distance = countDownDate - now;

                if (distance < 0) {
                    clearInterval(countdownTimers[feedElementId]);
                    document.getElementById(feedElementId).innerHTML = "";
                    delete countdownTimers[feedElementId];
                } else {
                    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                    let displayString = "";
                    if (days > 0) {
                        displayString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                    } else if (hours > 0) {
                        displayString = `${hours}h ${minutes}m ${seconds}s`;
                    } else if (minutes > 0) {
                        displayString = `${minutes}m ${seconds}s`;
                    } else if (seconds > 0) {
                        displayString = `${seconds}s`;
                    }

                    document.getElementById(feedElementId).innerHTML = displayString;
                }
            };
        }

        async function fetchFeed() {
            const response = await fetch('https://rentry.org/DVDoomFEED/raw');
            const data = await response.json();
            let feedString = "";
            data.forEach((feedItem) => {
                if (feedItem["approved"]) {
                    const feedElementId = feedItem["id"];
                    feedString += `
                        <td style="font-weight: bold; text-align: center; vertical-align: top;">
                            <div style="position: relative; text-align: justify;">
                                <center style="white-space: pre; padding-top: 5px; padding-left: 5px; padding-right: 5px;">${feedItem['text']}</center>
                                <hr style="margin-left: 20px; margin-right: 20px;">
                                <center class="image-container" data-images="${catboxReady(feedItem['icon'])}" style="width:240px; height:65px; padding-bottom: 2px;">
                                    <a href="${feedItem['url']}" target="_blank">
                                        <img src="${catboxReady(feedItem['icon'])}" alt="${feedItem['text']}" style="width:216px; height:65px; padding-left: 10px; padding-right: 10px;">
                                    </a>
                                </center>
                                <center style="white-space: pre; padding-left: 5px; padding-right: 5px; padding-bottom: 2px; padding-top: 2px;">${feedItem['description']}</center>
                                <center id="${feedElementId}" style="white-space: pre; padding-left: 5px; padding-right: 5px; padding-bottom: 2px; padding-top: 2px;"></center>
                            </div>
                        </td>
                `;

                    if (feedItem["countdown"]) {
                        const countDownDate = new Date(feedItem["countdown"]).getTime();
                        countdownTimers[feedElementId] = setInterval(updateCountdown(feedElementId, countDownDate), 1000);
                    }
                }
            });

            // Check if DVDoomParent exists, if not, create it
            let dvDoomParent = document.getElementById("DVDoomParent");
            if (!dvDoomParent) {
                dvDoomParent = document.createElement('div');
                dvDoomParent.id = "DVDoomParent";
                dvDoomParent.style.display = 'flex';
                dvDoomParent.style.marginLeft = '3.5px';
                dvDoomParent.style.marginRight = '12.5px';
                dvDoomParent.style.justifyContent = 'space-between';

                // Find an appropriate place to insert DVDoomParent
                let targetElement = document.querySelector('#threadList, .navLinks.desktop');
                if (targetElement) {
                    targetElement.parentNode.insertBefore(dvDoomParent, targetElement);
                } else {
                    document.body.appendChild(dvDoomParent);
                }
            }

            // Create and append the feed container
            let feedContainer = document.createElement('div');
            feedContainer.style.flexGrow = '5';
            feedContainer.style.flexBasis = '0';
            feedContainer.style.display = 'flex';
            feedContainer.style.flexDirection = 'column';
            feedContainer.style.alignItems = 'flex-end';
            feedContainer.style.justifyContent = 'center';


            if (feedString !== "") {
                feedContainer.innerHTML = `
                <table id="seia-feed" class="feed-table" style="margin-left: 0px; margin-right: 0px;">
                    <caption>
                        <tr>
                            <th colspan="4" style="padding: 8px; text-align: center;">
                                \<<span style="font-weight: bold;"> /bag/ Feed </span>\>
                            </th>
                        </tr>
                    </caption>
                    <tr>
                        ${feedString}
                    </tr>
                </table>
            `;
                feedContainer.hidden = false;
            }

            addElementToParent(feedContainer, dvDoomParent);
        }

        // Initialize the feed functionality
        fetchFeed();
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// GUIDE SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        async function fetchUsefulLinks() {
            // Create the useful links container
            let usefulLinksContainer = document.createElement('div');
            usefulLinksContainer.style.flexGrow = '1';
            usefulLinksContainer.style.flexBasis = '0';
            usefulLinksContainer.id = "seia-useful-links";

            // Find DVDoomParent
            let dvDoomParent = document.getElementById("DVDoomParent");
            if (!dvDoomParent) {
                // If DVDoomParent doesn't exist, we'll insert after the specified element
                let targetElement = document.querySelector('#threadList, .navLinks.desktop');
                if (targetElement) {
                    dvDoomParent = document.createElement('div');
                    dvDoomParent.id = "DVDoomParent";
                    targetElement.parentNode.insertBefore(dvDoomParent, targetElement.nextSibling);
                } else {
                    // If the specified element doesn't exist, we'll append to body
                    dvDoomParent = document.createElement('div');
                    dvDoomParent.id = "DVDoomParent";
                    document.body.appendChild(dvDoomParent);
                }
            }

            // Insert the useful links container after DVDoomParent
            dvDoomParent.insertAdjacentElement('afterend', usefulLinksContainer);

            // Add a horizontal rule after DVDoomParent
            dvDoomParent.insertAdjacentElement('afterend', document.createElement('hr'));
            usefulLinksContainer.insertAdjacentElement('afterend', document.createElement('hr'));

            const response = await fetch('https://rentry.org/DVDoomMISC/raw');
            const data = await response.json();
            let usefulStuffLeft = "";
            let usefulStuffRight = "";

            data.forEach((feedItem) => {
                if (feedItem["enabled"]) {
                    // The string to add.
                    const stringToAdd = `
                    <div style="text-align: center; max-width: 300px;">
                        <a href="${feedItem['url']}" target="_blank">
                            <img src="${catboxReady(feedItem['icon'])}" style="max-height: 60px; width: auto; display: block; margin: 0 auto;">
                        </a>
                    </div>
                `;
                    if (feedItem["side"] === "left") {
                        // Set the string.
                        usefulStuffLeft += stringToAdd;
                    } else if (feedItem["side"] === "right") {
                        // Set the string.
                        usefulStuffRight += stringToAdd;
                    }
                }
            });

            if (usefulStuffLeft === "" && usefulStuffRight === "") {
                usefulLinksContainer.hidden = true;
            } else {
                addInnerHTMLToParent(usefulLinksContainer, `
                    <div style="display: flex; flex-wrap: wrap; padding-left: 10px; padding-right: 10px; justify-content: space-between; gap: 20px;">
                        <div style="display: flex; gap: 20px;">
                            ${usefulStuffLeft}
                        </div>
                        <div style="display: flex; gap: 20px;">
                            ${usefulStuffRight}
                        </div>
                    </div>
                `)
                usefulLinksContainer.hidden = false;
            }
        }

        // Initialize the useful links functionality
        fetchUsefulLinks();
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// TWITTER SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        function functionHideMenu(currentElement) {
            window.removeEventListener('click', clickToHideDisplayMenu);
            document.removeEventListener("keydown", keyToHideDisplayMenu);
            currentElement.previousSibling.className = 'menu-button';
            currentElement.remove();
        }

        function clickToHideDisplayMenu(e) {
            const currentElement = document.getElementById('twitter-menu');
            if (!currentElement.contains(e.target)) {
                functionHideMenu(currentElement);
            }
        }

        function keyToHideDisplayMenu(e) {
            if (e.key === 'Escape') {
                const currentElement = document.getElementById('twitter-menu');
                functionHideMenu(currentElement);
            }
        }

        function functionDisplayMenu(e, twitterArrowContainer, tweetUser, tweetId) {
            // Get the positions.
            const boundingBox = twitterArrowContainer.getBoundingClientRect();
            const fragment = document.createDocumentFragment();
            const twitterMenu = document.createElement('div');
            twitterMenu.className = 'dialog';
            twitterMenu.id = 'twitter-menu';
            twitterMenu.tabindex = 0;
            twitterMenu.dataType = "get";

            let nitterURL, sotweURL;
            if (tweetId === '') {
                nitterURL = `https://nitter.poast.org/${tweetUser}`;
                sotweURL = `https://sotwe.com/${tweetUser}`;
            } else {
                nitterURL = `https://nitter.poast.org/${tweetUser}/status/${tweetId}`;
                sotweURL = `https://sotwe.com/tweet/${tweetId}`;
            }

            twitterMenu.innerHTML = `
            <a class="copy-text-link entry" href="${nitterURL}" target="_blank" style="order: 10;">Nitter</a>
            <a class="copy-text-link entry" href="${sotweURL}" target="_blank" style="order: 20;">Sotwe</a>
        `;
            window.addEventListener('click', clickToHideDisplayMenu);
            document.addEventListener("keydown", keyToHideDisplayMenu);
            Object.assign(twitterMenu.style, {
                zIndex: 2,
                position: 'absolute',
                top: `${boundingBox.bottom + window.scrollY}px`,
                left: `${boundingBox.left + window.scrollX}px`,
            });
            fragment.appendChild(twitterMenu);
            twitterArrowContainer.parentNode.insertBefore(fragment, twitterArrowContainer.nextElementSibling);
        }

        window.getAlternativeURLs = (twitterArrowContainer, e, tweetUser, tweetId) => {
            const currentActiveElement = document.getElementById('twitter-menu');
            if (currentActiveElement) {
                if (twitterArrowContainer.className == 'menu-button') {
                    functionHideMenu(currentActiveElement);
                    twitterArrowContainer.className = 'menu-button active';
                    functionDisplayMenu(e, twitterArrowContainer, tweetUser, tweetId);
                } else {
                    functionHideMenu(currentActiveElement);
                }
            } else {
                twitterArrowContainer.className = 'menu-button active';
                functionDisplayMenu(e, twitterArrowContainer, tweetUser, tweetId);
            }
            e.stopPropagation();
        };

        function addTwitterOptions(linkifiedTwitter) {
            linkifiedTwitter.classList.add("seia-checked");
            const fragment = document.createDocumentFragment();
            const twitterArrowContainer = document.createElement('a');
            twitterArrowContainer.className = 'menu-button';
            Object.assign(twitterArrowContainer.style, {
                'width': '18px',
                'textAlign': 'center'
            });
            const twitterArrowIcon = document.createElement('i');
            twitterArrowIcon.className = 'fa fa-angle-down';
            twitterArrowContainer.appendChild(twitterArrowIcon);

            // Obtain the host.
            const host = linkifiedTwitter.text.replace('https://', '').replace('www.', '').split('.com')[0].toLowerCase();

            let prefixElement;
            if (host == 'x' || host == 'fixupx' || host == 'twitter') {
                prefixElement = linkifiedTwitter.nextElementSibling;
                if (prefixElement !== null && prefixElement.className === 'embedder') {
                    prefixElement = prefixElement.nextElementSibling;
                }
            } else {
                return;
            }

            const tweetId = (linkifiedTwitter.text.includes('/status/')) ? linkifiedTwitter.text.split('/status/').pop() : '';
            const tweetUser = linkifiedTwitter.text.split('.com/').pop().split('/')[0];
            fragment.appendChild(twitterArrowContainer);
            twitterArrowContainer.setAttribute('onclick', `getAlternativeURLs(this, event, '${tweetUser}', '${tweetId}')`);
            linkifiedTwitter.parentNode.insertBefore(fragment, prefixElement);
        }

        // The live collection to listen.
        const linkifyListener = document.getElementsByClassName("linkify");
        // Every 5 seconds add twitter options to the links.
        setInterval(() => {
            // Obtain the linkified twitter.
            [...linkifyListener].forEach((element) => {
                // Check if element does not have the right class.
                if (!element.classList.contains('seia-checked')) addTwitterOptions(element);
            });
        }, 5000);

    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// SERVER SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        // Mimori was here
        const toggleStyles = `
        .server-toggle {
            position: relative;
            display: flex;
            flex-direction: column;
            width: 30px;
            padding: 1px;
            margin-top: 10px;
            margin-bottom: 10px;
        }
        .server-toggle button {
            border-collapse: separate;
            border-spacing 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            color: inherit;
            background-color: transparent;
            cursor: pointer;
            transition: all 0.3s ease;
            padding: 10px 0;
            margin: 2.5px;
            width: 100%;
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            text-align: center;
            opacity: 0.35;
        }
        .server-toggle button.selected {
            font-weight: 550;
            opacity: 1;
        }
        .server-toggle button:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }
        .lang-toggle button {
            padding: 10px;
            margin-left: 10px; /* Add space between server and language toggles */
        }

        .server-toggle-tooltip-button {
            border-radius: 15px !important;
            opacity: 0.75 !important;
        }

        .server-toggle-tooltip {
            position: absolute;
            background-color: #333;
            color: white;
            padding: 10px;
            border-radius: 4px;
            display: none;
            left: 100%;
            top: 50%;
            transform: translateY(-100%);
            margin-left: 5px;
            white-space: nowrap;
            z-index: 1000;
        }

        .server-toggle-tooltip::after {
            content: '';
            position: absolute;
            top: 50%;
            right: 100%;
            margin-top: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: transparent #333 transparent transparent;
        }

        .server-toggle-tooltip-button:hover {
            background-color: transparent!important;
        }

        .server-toggle-tooltip-button:hover + .server-toggle-tooltip,
        .server-toggle-tooltip:hover {
            display: block;
        }
        `;

        let timerIds = []; // Store active timer IDs

        // Function to check if an item has expired based on its end time (handles Unix timestamp and formatted date string)
        function hasExpired(endTime) {
            let expirationTime;

            // Check if endTime is a string (formatted date) or a Unix timestamp
            if (typeof endTime === 'string') {
                // If it's a string, we parse it to a timestamp
                const parsedDate = new Date(endTime); // Parse the formatted date string
                expirationTime = parsedDate.getTime(); // Get timestamp in milliseconds
            } else {
                // If it's a Unix timestamp, ensure it's in milliseconds
                expirationTime = endTime < 1e12 ? endTime * 1000 : endTime;
            }

            const currentTime = Date.now();
            return expirationTime <= currentTime;
        }

        // Function to check if an item has started based on its start time (handles Unix timestamp and formatted date string)
        function hasStarted(startTime) {
            let beginTime;

            // Check if startTime is a string (formatted date) or a Unix timestamp
            if (typeof startTime === 'string') {
                // If it's a string, we parse it to a timestamp
                const parsedDate = new Date(startTime); // Parse the formatted date string
                beginTime = parsedDate.getTime(); // Get timestamp in milliseconds
            } else {
                // If it's a Unix timestamp, ensure it's in milliseconds
                beginTime = startTime < 1e12 ? startTime * 1000 : startTime;
            }

            const currentTime = Date.now();
            return beginTime <= currentTime;
        }


        /**
         * Calculates the time remaining until the start or end of an event
         * @param {Date} endTime - The end time of the event
         * @param {Date} startTime - The start time of the event
         * @returns {string} Time left as "Starts in" or "Time Left" with countdown
         */
        function calculateTimeLeft(startTime, endTime) {
            const now = new Date().getTime();
            const start = new Date(startTime).getTime();
            const end = new Date(endTime).getTime();

            // If the event hasn't started yet, show "Starts in" with countdown to start
            if (now < start) {
                const timeUntilStart = start - now;
                return `Starts in: ${formatDuration(timeUntilStart)}`;
            }

            // If the event is ongoing, show "Time Left" with countdown to end
            if (now < end) {
                const timeUntilEnd = end - now;
                return `Time Left: ${formatDuration(timeUntilEnd)}`;
            }

            // If the event has ended
            return "Event Ended";
        }

        /**
         * Formats a duration in milliseconds into "D days, H hours, M minutes" format
         * @param {number} duration - Duration in milliseconds
         * @returns {string} Formatted duration string
         */
        function formatDuration(duration) {
            const days = Math.floor(duration / (1000 * 60 * 60 * 24));
            const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

            return `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m`;
        }

        // Getting the current Gacha banner, Event(s), and Raid(s)
        // JFD's also fall under the "Raids" section
        // Total Assault, Grand Assault (same category as TA's), JFDs, Limit Break/Final Restriction, World Raid
        async function getCurrentGachaEventsRaids(region, lang) {

            function capitalizeFirstLetter(string) {
                return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
            }

            const baseUrl = "https://schaledb.com/data/";

            // Modify the fetch URLs to use the lang parameter
            // Use const raidsData = await fetch(`${baseUrl}/en/raids.json`).then(res => res.json()); for just English text
            const configData = await fetch(`${baseUrl}config.json`).then(res => res.json());
            const localizationData = await fetch(`${baseUrl}${lang}/localization.json`).then(res => res.json());
            const raidsData = await fetch(`${baseUrl}${lang}/raids.json`).then(res => res.json());

            // Fetch all student-related data including name and other details
            async function fetchStudentData() {
                // Fetch both students data and localization data in parallel
                const [studentsResponse, localizationResponse] = await Promise.all([
                    fetch('https://schaledb.com/data/en/students.json'),
                    fetch('https://schaledb.com/data/en/localization.json')
                ]);

                const studentsData = await studentsResponse.json();
                const localizationData = await localizationResponse.json();

                // Create a map with the student ID as the key and the student details as the value
                const studentMap = Object.values(studentsData).reduce((acc, student) => {
                    const studentFullName = `${student.FamilyName} ${student.PersonalName}`;
                    acc[student.Id] = {
                        name: studentFullName, // Student's full name
                        displayName: student.Name,
                        SquadType: getLocalizedDetail(student.SquadType, localizationData.SquadType),
                        TacticRole: getLocalizedDetail(student.TacticRole, localizationData.TacticRole),
                        BulletType: getLocalizedDetail(student.BulletType, localizationData.BulletType),
                        ArmorType: getLocalizedDetail(student.ArmorType, localizationData.ArmorType)
                    };
                    return acc;
                }, {});

                return studentMap;
            }

            // Helper function to get localized data
            function getLocalizedDetail(value, localizationData) {
                if (value && localizationData[value]) {
                    // Capitalize the first letter and lowercase the rest
                    return `${localizationData[value][0].toUpperCase()}${localizationData[value].slice(1).toLowerCase()}`;
                }
                return value; // Return value as is if no localization is found
            }

            // Function to get the student's details by ID (name and other details)
            async function getStudentDetailsById(id) {
                // Cache student data to avoid multiple fetches
                if (!window.studentMap) {
                    window.studentMap = await fetchStudentData();
                }

                // Return the student's details or a message if the ID is not found
                return window.studentMap[id] ?? `Unknown student with ID ${id}`;
            }

            let tableCells = '';

            // Search for the region by Name within configData.Regions
            const regionData = configData.Regions.find(reg => reg.Name === region) || {};

            // Access CurrentEvents, CurrentGacha, and CurrentRaid using regionData
            const currentEvents = regionData.CurrentEvents || {};
            const currentGacha = regionData.CurrentGacha || {};
            const currentRaids = regionData.CurrentRaid || {};

            function formatDate(timestamp) {
                const date = new Date(timestamp * 1000);
                const formattedDate = date.toLocaleString('en-GB', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                const [datePart, timePart] = formattedDate.split(', ');
                const [day, month, year] = datePart.split('/');
                return `${year}/${month}/${day}, ${timePart}`;
            }

            /**
             * Sets up and updates the countdown timer every second
             * @param {Date} startTime - The start time of the event
             * @param {Date} endTime - The end time of the event
             * @param {string} elementId - The ID of the HTML element where the timer is displayed
             */
            function createCountdownTimer(startTime, endTime, elementId) {
                let timerId = setInterval(1000);
                const updateTimer = () => {
                    const timerElement = document.getElementById(elementId);
                    const displayText = calculateTimeLeft(startTime, endTime);

                    if (timerElement) {
                        timerElement.textContent = displayText;
                    } else {
                        clearInterval(timerId); // Clear interval if element is missing
                    }

                    // Stop the interval if the event has ended
                    if (displayText === "Event Ended") {
                        clearInterval(timerId);
                    }
                };

                updateTimer(); // Initial update
                timerId = setInterval(updateTimer, 1000); // Update every second
                timerIds.push(timerId); // Store the timer ID
            }

            const uniformSpacing = '10px';

            const cellStyle = `
            flex: 1;
            vertical-align: top;
            padding: 2.5px;
        `;

            const sectionStyle = `
            display: flex;
            flex-direction: column;
            gap: ${uniformSpacing};
        `;

            const rowStyle = `
            display: flex;
            gap: ${uniformSpacing};
        `;

            const innerDivStyle = `
            border: 1px solid #ccc;
            border-radius: 5px;
            display: flex;
            flex-direction: column;
            flex: 1;
        `;

            const headerStyle = `
            line-height: 1.2;
            text-size-adjust: 100%;
            font-weight: bold;
            padding: 10px;
            text-align: center;
            border-bottom: 1px solid #ccc;
        `;

            const contentStyle = `
            height: 125px;
            display: flex;
            justify-content: space-evenly;
            align-items: center;
            padding: 10px;
        `;

            const footerStyle = `
            padding: 10px;
            text-align: center;
            border-top: 1px solid #ccc;
        `;

            // Process Current Gacha
            let gachaCell = "";

            for (const [gachaNum, gachaData] of Object.entries(currentGacha)) {
                // Skip this gacha banner if expired
                if (hasExpired(gachaData.end)) {
                    continue;
                }
                const startTime = formatDate(gachaData.start);
                const endTime = formatDate(gachaData.end);

                gachaCell += `
                    <td style="${cellStyle}">
                        <div style="${sectionStyle}">
                            <div style="${innerDivStyle}">
                                <div style="${headerStyle}">${hasStarted(gachaData.start) ? 'Current Gacha' : 'Upcoming Gacha'}</div>
                                <div style="${contentStyle}">
                `;

                for (const studentId of gachaData.characters) {
                    const studentDetails = await getStudentDetailsById(studentId);
                    const studentName = studentDetails.displayName;
                    const studentImage = `https://schaledb.com/images/student/collection/${studentId}.webp`;

                    // Fetch additional student details from localizationData
                    // Check and format each detail to avoid undefined values
                    const bulletType = localizationData[studentDetails.BulletType] || studentDetails.BulletType || "Unknown";
                    const armorType = localizationData[studentDetails.ArmorType] || studentDetails.ArmorType || "Unknown";
                    const tacticRole = localizationData[studentDetails.TacticRole] || studentDetails.TacticRole || "Unknown";
                    const squadType = localizationData[studentDetails.SquadType] || studentDetails.SquadType || "Unknown";


                    gachaCell += `
                        <div style="display: inline-block; padding: 8px;">
                            <div style="position: relative; text-align: justify;">
                                <center class="image-container" style="width:60px;height:60px;">
                                    <img src="${studentImage}" alt="${studentName}" style="width:50px;height:50px;">
                                </center>
                                <center style="font-weight: bold; white-space: pre;">${studentName.replace(' ', '\n')}</center>
                                <center style="text-align: center; font-size: 0.8em;">${squadType} | ${tacticRole}</center>
                                <center style="text-align: center; font-size: 0.8em;">${bulletType} / ${armorType}</center>
                            </div>
                        </div>
                    `;
                }

                gachaCell += `</div>`;

                const timerId = `gacha-timer-${gachaNum}`;
                gachaCell += `
                                <div style="${footerStyle}">
                                    <div>${startTime} - ${endTime}</div>
                                    <div id="${timerId}" style="margin-top: 5px;">Time Left: ${calculateTimeLeft(gachaData.end)}</div>
                                </div>
                            </div>
                        </div>
                    </td>
                `;
                // Set up the timer after the element is added to the DOM
                setTimeout(() => createCountdownTimer(startTime, endTime, timerId), 0);
            }

            if (gachaCell !== '') {
                tableCells += gachaCell;
            }

            if (Object.keys(currentEvents).length > 0) {
                // Process Current Events
                let eventsCell = "";

                for (let i = 0; i < Object.keys(currentEvents).length; i += 2) {
                    const eventEntries = Object.entries(currentEvents).slice(i, i + 2);
                    let innerEventsCell = '';

                    eventEntries.forEach(([eventNum, eventData]) => {
                        // Check if the event has expired
                        if (hasExpired(eventData.end)) {
                            console.log(`Event ${eventNum} has expired, skipping.`);
                            return; // Skip this event if expired
                        }

                        // Get the full event ID
                        const fullEventId = eventData.event.toString();

                        // Check if it's a rerun based on the "10" prefix
                        const isRerun = fullEventId.startsWith("10");

                        // Slice off the prefix "10" for the actual event ID
                        const eventId = isRerun ? fullEventId.slice(2) : fullEventId;

                        // Get the event name from localizationData
                        let eventName = localizationData.EventName?.[eventId] || "Unknown Event";

                        // If it's a rerun, append "(Rerun)" to the event name
                        if (isRerun) {
                            eventName += " (Rerun)";
                        }
                        const eventImage = `https://schaledb.com/images/eventlogo/${eventId}_${region === 'Global' ? 'En' : 'Jp'}.webp`;
                        const startTime = formatDate(eventData.start);
                        const endTime = formatDate(eventData.end);
                        const timerId = `event-timer-${eventNum}`;
                        innerEventsCell += `
                            <div style="${innerDivStyle}">
                                <div style="${headerStyle}">Event</div>
                                <div style="${contentStyle}">
                                    <div style="display: block;">
                                        <div style="display: flex; justify-content: space-evenly; align-items: center;">
                                            <img src="${eventImage}" alt="${eventName}" style="max-width: 240px; max-height: 80px; width: auto; height: auto; object-fit: contain;">
                                        </div>
                                        <center style="flex: 1; width: 100%; min-width: 0;">${eventName}</center>
                                    </div>
                                </div>
                                <div style="${footerStyle}">
                                    <div>${startTime} - ${endTime}</div>
                                    <div id="${timerId}" style="margin-top: 5px;">Time Left: ${calculateTimeLeft(eventData.end)}</div>
                                </div>
                            </div>
                        `;
                        // Set up the timer after the element is added to the DOM
                        setTimeout(() => createCountdownTimer(startTime, endTime, timerId), 0);
                    });

                    if (innerEventsCell !== '') {
                        eventsCell += `<div style="${rowStyle}">` + innerEventsCell + `</div>`;
                    }
                }

                if (eventsCell !== '') {
                    tableCells += `<td style="${cellStyle}"><div style="${sectionStyle}">` + eventsCell + `</div></td>`;
                }
            }

            // Process Current Raids

            // Function to get Torment armor type from the dvdoomutils data
            // Defaults to JP data, but can be changed for EN
            // Define the color-to-armor type mappings (using lowercase and no punctuation for keys)
            // This should work no matter what so long as its spelled right
            function getTormentArmorType(region, localizationData) {
                return fetch("https://rentry.org/dvdoomutils/raw")
                    .then(response => response.json())
                    .then(dvdoomutilsData => {
                        // Normalize region name to lowercase and strip punctuation
                        let normalizedRegion = region.toLowerCase().replace(/[^\w]/g, '');

                        // Treat "en" as equivalent to "global" and map it to "EN"
                        if (normalizedRegion === 'en' || normalizedRegion === 'global') {
                            normalizedRegion = 'en';
                        }

                        // Find matching region key in dvdoomutilsData, default to "JP" if no match
                        const regionKey = Object.keys(dvdoomutilsData).find(key =>
                            key.toLowerCase().replace(/[^\w]/g, '') === normalizedRegion
                        ) || 'JP';

                        // Access torment armor color, using the matched region key
                        const tormentColor = dvdoomutilsData[regionKey]["GA"]["ARMOR"]["TORMENT"];

                        // Normalize the color to lowercase without punctuation
                        const normalizedColor = tormentColor.toLowerCase().replace(/[^\w]/g, '');

                        // Define color-to-armor type mappings
                        const colorToArmorType = {
                            "red": "LightArmor",
                            "yellow": "HeavyArmor",
                            "blue": "Unarmed",
                            "structure": "Structure",
                            "purple": "ElasticArmor",
                            "gray": "Normal",
                            "grey": "Normal",
                            "mixed": "Mixed"
                        };

                        // Fetch the corresponding armor type from localization data
                        const armorTypeKey = colorToArmorType[normalizedColor];
                        return localizationData.ArmorTypeLong[armorTypeKey] || "Unknown Armor Type";
                    })
                    .catch(error => {
                        console.error("Error fetching Torment Armor Type:", error);
                        return "Error loading";
                    });
            }

            let raidsCell = ''; //`<td style="${cellStyle}"><div style="${sectionStyle}">`;

            // Map raid types to display names
            const raidTypeMapping = {
                "Raid": "Total Assault",
                "EliminateRaid": "Grand Assault",
                "MultiFloorRaid": "Final Restriction Release",
                "TimeAttack": "Joint Firing Drill",
                "WorldRaid": "World Raid"
            };

            for (let i = 0; i < Object.keys(currentRaids).length; i += 2) {
                const raidEntries = Object.entries(currentRaids).slice(i, i + 2);

                raidEntries.forEach(([raidNum, raidData]) => {
                    const startTime = formatDate(raidData.start);
                    const endTime = formatDate(raidData.end);
                    // Use hasExpired to check if the raid is ongoing or expired
                    if (hasExpired(endTime)) {
                        // Optional: Skip expired raids
                        console.log(`Raid ${raidNum} has expired and will not be displayed.`);
                        return; // Skip to the next raid if expired
                    }
                    const raidId = raidData.raid;
                    const raidType = raidData.type || "Unknown Type";
                    const displayType = raidTypeMapping[raidType] || "Unknown Type";
                    let raidInfo = {};
                    let season = raidData.season || ""; // Only use season if relevant
                    let innerRaidsCell = '';
                    // Handle different raid types
                    if (raidType === "Raid") {
                        // Standard raids data, indexed by raidId - 1
                        const raidIndex = raidId - 1;
                        raidInfo = raidsData.Raid?.[raidIndex] || {};
                    } else if (raidType === "EliminateRaid") {
                        const raidIndex = raidId - 1;
                        raidInfo = raidsData.Raid?.[raidIndex] || {};

                        // Generate a unique ID for the raid timer
                        const timerId = `raid-timer-${raidNum}`;

                        // Gather other raid information
                        const terrain = raidData.terrain || raidInfo.Terrain || "Unknown Terrain";
                        const startTime = formatDate(raidData.start);
                        const endTime = formatDate(raidData.end);
                        const raidName = raidInfo.Name || "Unknown Raid";
                        const raidDevName = raidInfo.DevName || "Unknown DevName";
                        const iconName = `Boss_Portrait_${raidDevName}_Lobby` || `Boss_Portrait_${raidName}_Lobby`;
                        const raidImage = `https://schaledb.com/images/raid/${iconName}.png`;
                        const attackType = localizationData.BulletType?.[raidInfo.BulletTypeInsane] || raidInfo.BulletTypeInsane;


                        innerRaidsCell += `
                            <div style="${innerDivStyle}">
                                <div style="${headerStyle}">${displayType} | ${raidName} ${season ? `| Season: ${season}` : ""}</div>
                                <div style="${contentStyle}">
                                    <div style="display: block;">
                                        <div style="display: flex; justify-content: space-evenly; align-items: center;">
                                            <img src="${raidImage}" alt="${raidName}" style="max-width: 240px; max-height: 80px; width: auto; height: auto; object-fit: contain;">
                                        </div>
                                        <center style="flex: 1; width: 100%; min-width: 0;"><b>Terrain:</b> ${terrain}</center>
                                        <center style="flex: 1; width: 100%; min-width: 0;"><b>Torment+ Armor Type:</b> <span id="armor-type-${raidNum}">Loading...</span></center>
                                        <center style="flex: 1; width: 100%; min-width: 0;"><b>Attack Type:</b> ${attackType}</center>
                                    </div>
                                </div>
                                <div style="${footerStyle}">
                                    <div>${startTime} - ${endTime}</div>
                                    <div id="${timerId}" style="margin-top: 5px;">Time Left: ${calculateTimeLeft(raidData.end)}</div>
                                </div>
                            </div>
                        `;

                        // Set up the timer after the element is added to the DOM
                        setTimeout(() => createCountdownTimer(startTime, endTime, timerId), 0);

                        // Fetch and load the Torment armor type without duplicating the cell (because it used to do that)
                        getTormentArmorType(region, localizationData).then(tormentArmorType => {
                            const element = document.getElementById(`armor-type-${raidNum}`);
                            if (element) {
                                element.innerText = tormentArmorType;
                            }
                        });
                        raidsCell += `<td style="${cellStyle}"><div style="${sectionStyle}"><div style="${rowStyle}">` + innerRaidsCell + `</div></td>`;
                        return;
                    } else if (raidType === "MultiFloorRaid") {
                        // MultiFloorRaid data, matched by Id, no season
                        raidInfo = Object.values(raidsData.MultiFloorRaid || {}).find(raid => raid.Id === raidData.raid) || {};

                        // Extract data or set default values if missing
                        const terrain = raidInfo.Terrain || "Unknown Terrain";
                        const raidName = raidInfo.Name || "Unknown Raid";
                        const raidDevName = raidInfo.DevName || "Unknown DevName";
                        const startTime = formatDate(raidData.start);
                        const endTime = formatDate(raidData.end);
                        const iconName = raidInfo.icon || `Boss_Portrait_${raidDevName}_Lobby`;
                        const raidImage = `https://schaledb.com/images/raid/${iconName}.png`;
                        const timerId = `raid-timer-${raidNum}`;

                        // Set up the timer after the element is added to the DOM
                        setTimeout(() => createCountdownTimer(startTime, endTime, timerId), 0);

                        // Check BulletType and ArmorType
                        const bulletTypes = raidInfo.BulletType || [];
                        const armorType = raidInfo.ArmorType || "Unknown Armor";

                        // Map bullet types to localized names
                        const localizedArmorType = capitalizeFirstLetter(localizationData.ArmorType?.[armorType] || armorType);

                        // Construct floor change message
                        let minFloor = '';
                        let minFloorAttackType = '';
                        let floor = 0;

                        // Loop through the floors to check where the BulletType changes
                        for (let i = 0; i < raidInfo.BulletType.length; i++) {
                            const bulletType = raidInfo.BulletType[i - 1]; // Get the BulletType at the current floor index
                            const currentBulletType = raidInfo.BulletType[i]; // Current BulletType at this floor
                            if (bulletType == "Normal" && currentBulletType !== "Normal") {
                                // Once the BulletType changes from "Normal", capture the floor and change the message
                                minFloor = `F${floor}+`;
                                minFloorAttackType = `${localizationData.BulletType?.[currentBulletType]}`;
                                break; // Stop once the change is found
                            }
                            floor += 25;
                        }
                        // Add content to raidsCell
                        innerRaidsCell = `
                            <div style="${innerDivStyle}">
                                <div style="${headerStyle}">Limit Break Assault | ${raidName}</div>
                                <div style="${contentStyle}">
                                    <div style="display: block;">
                                        <div style="display: flex; justify-content: space-evenly; align-items: center;">
                                            <img src="${raidImage}" alt="${raidName}" style="max-width: 240px; max-height: 80px; width: auto; height: auto; object-fit: contain;">
                                        </div>
                                        <center style="flex: 1; width: 100%; min-width: 0;"><b>Terrain:</b> ${terrain}</center>
                                        <center style="flex: 1; width: 100%; min-width: 0;">
                                            <b>Armor Type:</b> ${localizedArmorType}
                                        </center>
                                        ${minFloor ? `<center style="flex: 1; width: 100%; min-width: 0;"><b>${minFloor} Attack Type:</b> ${minFloorAttackType}</center>` : ''}
                                    </div>
                                </div>
                                <div style="${footerStyle}">
                                    <div>${startTime} - ${endTime}</div>
                                    <div id="${timerId}" style="margin-top: 5px;">Time Left: ${calculateTimeLeft(raidData.end)}</div>
                                </div>
                            </div>
                        `;
                        raidsCell += `<td style="${cellStyle}"><div style="${sectionStyle}"><div style="${rowStyle}">` + innerRaidsCell + `</div></td>`;
                        return;
                    } else if (raidType === "TimeAttack") {
                        // TimeAttack uses raidId as the key in raidsData.TimeAttack
                        // Find the TimeAttack data in raids.json by matching the 'raid' value from config.json
                        raidInfo = Object.values(raidsData.TimeAttack || {}).find(raid => raid.Id === raidData.raid) || {};

                        // Extract TimeAttack-specific data or set default values if missing
                        const dungeonType = raidInfo.DungeonType || "Unknown Dungeon";
                        const terrain = raidInfo.Terrain || "Unknown Terrain";
                        const startTime = formatDate(raidData.start);
                        const endTime = formatDate(raidData.end);
                        const iconName = raidInfo.Icon || `enemyinfo_placeholder`;
                        const raidImage = `https://schaledb.com/images/enemy/${iconName}.webp`;

                        // Only take the last set of rule IDs from TimeAttack -> Rules
                        // Usually, the final set (stage 4) will have all rules applied
                        const rulesArray = raidInfo.Rules || [];
                        const lastRuleSet = rulesArray[rulesArray.length - 1] || []; // Get the last set or an empty array if not found
                        let rulesDescriptions = `<div><ul>`;

                        // Function to replace identifiers with localized names, making every identifier bold
                        // ba-col is used as a class to color text based off its type (Explosive = red, Piercing = yellow, etc)
                        const replaceIdentifiers = (text, localizationData) => {
                            return text.replace(/<([a-z]):([A-Za-z0-9_]+)>/g, (match, type, identifier) => {
                                // Determine prefix based on type
                                let prefix;
                                if (type === 'b') prefix = 'Buff'; // Bolden Buff types
                                else if (type === 'c') prefix = 'CC'; // Bolden CC types
                                else if (type === 'd') prefix = 'Debuff'; // Bolden Debuff types
                                else if (type === 's') prefix = 'Special'; // Bolden Special types
                                else return match; // Return the match as-is if type doesn't match any of the above

                                // Construct localization key and look up with BuffName priority over BuffNameLong
                                const localizationKey = `${prefix}_${identifier}`;
                                let replacementText;

                                if (localizationData.BuffName && localizationData.BuffName[localizationKey]) {
                                    replacementText = localizationData.BuffName[localizationKey];
                                } else if (localizationData.BuffNameLong && localizationData.BuffNameLong[localizationKey]) {
                                    replacementText = localizationData.BuffNameLong[localizationKey];
                                } else {
                                    // If no match is found in localization data, use the identifier with spaces for underscores
                                    replacementText = identifier.replace(/_/g, ' ');
                                }

                                // Bolden the whole match (<type:identifier>) and replace with replacementText
                                return `<b>${replacementText}</b>`;
                            });
                        };

                        // Process each rule ID in the last rule set
                        lastRuleSet.forEach(ruleObj => {
                            const ruleId = ruleObj.Id;
                            const parameters = ruleObj.Parameters || [];

                            if (ruleId === 990306261 || ruleId === 1329507091 || ruleId === 3938056289) return;

                            // Find the matching rule in TimeAttackRules by Id
                            const matchedRule = (raidsData.TimeAttackRules || []).find(rule => rule.Id === ruleId);

                            if (matchedRule) {
                                let ruleName = matchedRule.Name || "Unknown Rule Name";
                                let ruleDesc = matchedRule.Desc || "No Description Available";

                                // Replace placeholders in the description if parameters are present
                                if (parameters.length > 0) {
                                    parameters.forEach((paramGroup, index) => {
                                        const placeholder = `<?${index + 1}>`; // Placeholder format is <?1>, <?2>, etc.
                                        if (paramGroup[0]) {
                                            ruleDesc = ruleDesc.replace(placeholder, paramGroup[0]);
                                        }
                                    });
                                }

                                // Replace identifiers like <s:ImmuneDamage> using localization data
                                // Do we call these indentifiers anyways?
                                ruleDesc = replaceIdentifiers(ruleDesc, localizationData);

                                rulesDescriptions += `<li style="font-size: 11px;">${ruleDesc}</li>`;
                            } else {
                                rulesDescriptions += `<li style="font-size: 11px;">Unknown Rule - No Description Available</li>`;
                            }
                        });

                        rulesDescriptions += `</ul></div>`; // Close the rules descriptions div

                        const timerId = `raid-timer-${raidNum}`;
                        innerRaidsCell = `
                            <div style="${innerDivStyle}">
                                <div style="${headerStyle}">Joint Firing Drill | ${dungeonType} | ${terrain}</div>
                                <div style="${contentStyle}">
                                    <div style="display: block;">
                                        <div style="display: flex; justify-content: space-evenly; align-items: center;">
                                            <img src="${raidImage}" alt="${dungeonType}" style="max-width: 240px; max-height: 60px; width: 240px; height: auto; object-fit: contain;">
                                        </div>
                                        ${rulesDescriptions}
                                    </div>
                                </div>
                                <div style="${footerStyle}">
                                    <div>${startTime} - ${endTime}</div>
                                    <div id="${timerId}" style="margin-top: 5px;">Time Left: ${calculateTimeLeft(raidData.end)}</div>
                                </div>
                            </div>
                        `;
                        raidsCell += `<td style="${cellStyle}"><div style="${sectionStyle}"><div style="${rowStyle}">` + innerRaidsCell + `</div></div></td>`;
                        // Set up the timer after the element is added to the DOM
                        setTimeout(() => createCountdownTimer(startTime, endTime, timerId), 0);
                        return;
                    } else if (raidType === "WorldRaid") {
                        // WorldRaid data can use direct matching without season
                        // Good old untested code because these run so rarely
                        // This will probably not work, honestly
                        raidInfo = raidsData.WorldRaid?.find(raid => raid.Id === raidId) || {};
                    }

                    // Gather details with default fallbacks
                    const terrain = raidData.terrain || raidInfo.Terrain || "Unknown Terrain";
                    const raidName = raidInfo.Name || "Unknown Raid";
                    const raidDevName = raidInfo.DevName || "Unknown DevName";
                    const iconName = `Boss_Portrait_${raidDevName}_Lobby` || `Boss_Portrait_${raidName}_Lobby`;
                    const raidImage = `https://schaledb.com/images/raid/${iconName}.png`;
                    const attackType = localizationData.BulletType?.[raidInfo.BulletTypeInsane] || raidInfo.BulletTypeInsane;
                    const armorType = raidInfo.ArmorType || "Unknown Armor";

                    // Map bullet types to localized names
                    const localizedArmorType = capitalizeFirstLetter(localizationData.ArmorType?.[armorType] || armorType);

                    const timerId = `raid-timer-${raidNum}`;
                    innerRaidsCell = `
                        <div style="${innerDivStyle}">
                            <div style="${headerStyle}">${displayType} ${season ? `Season: ${season}` : ""} | ${raidName}</div>
                            <div style="${contentStyle}">
                                <div style="display: block;">
                                    <div style="display: flex; justify-content: space-evenly; align-items: center;">
                                        <img src="${raidImage}" alt="${raidName}" style="max-width: 240px; max-height: 80px; width: auto; height: auto; object-fit: contain;">
                                    </div>
                                    <center style="flex: 1; width: 100%; min-width: 0;"><b>Terrain:</b> ${terrain}</center>
                            <center style="flex: 1; width: 100%; min-width: 0;"><b>Armor Type:</b> ${localizedArmorType}</center>
                                    <center style="flex: 1; width: 100%; min-width: 0;"><b>Insane+ Attack Type:</b> ${attackType}</center>
                                </div>
                            </div>
                            <div style="${footerStyle}">
                                <div>${startTime} - ${endTime}</div>
                                <div id="${timerId}" style="margin-top: 5px;">Time Left: ${calculateTimeLeft(raidData.end)}</div>
                            </div>
                        </div>
                    `;
                    raidsCell += `<td style="${cellStyle}"><div style="${sectionStyle}"><div style="${rowStyle}">` + innerRaidsCell + `</div></td>`;
                    // Set up the timer after the element is added to the DOM
                    setTimeout(() => createCountdownTimer(startTime, endTime, timerId), 0);
                });
            }

            if (raidsCell !== '') {
                tableCells += raidsCell + `</div></td>`;
            }

            if (tableCells === '') {
                tableCells = `
                    <td style="${cellStyle}">
                        <div style="${sectionStyle}">
                            <div style="${rowStyle}">
                                <div style="${innerDivStyle}">
                                    <div style="${headerStyle}"></div>
                                    <div style="${contentStyle}">
                                        No data currently available to display.
                                    </div>
                                    <div style="${footerStyle}">

                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                `;
            }

            // Insert final HTML into the page
            let finalString = `
                <div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <table style="width: 100%; display: table; border-collapse: separate; padding-right: ${uniformSpacing}; padding-top: ${uniformSpacing}; padding-bottom: ${uniformSpacing};">
                        <tr style="display: flex; width: 100%;">${tableCells}</tr>
                    </table>
                </div>
            `;

            // Modify the part where inserting the final HTML to append it to the container
            const serverToggle = document.querySelector('.server-toggle');
            if (serverToggle) {
                const container = serverToggle.parentNode;

                // Create a wrapper div for the table
                const tableWrapper = document.createElement('div');
                tableWrapper.id = "current-ba-info"
                tableWrapper.innerHTML = finalString;
                tableWrapper.style.cssText = `flex: 1; min-width: 0;`;

                // Remove top padding from the table wrapper
                const tableElement = tableWrapper.querySelector('table');
                if (tableElement) {
                    tableElement.style.marginTop = '0';
                }

                addElementToParent(tableWrapper, container);
            }
        }

        let currentRegion = localStorage.getItem("currentRegion") || "Global";
        let currentLang = localStorage.getItem("currentLang") || 'en';

        // Extend the createUI function
        function createUI() {
            // Add the styles
            const styleElement = document.createElement('style');
            styleElement.textContent = toggleStyles;
            document.head.appendChild(styleElement);

            const serverSelection = document.createElement("div");
            serverSelection.className = "server-toggle";

            const toggleServerButton = document.createElement("button");
            toggleServerButton.className = "server-toggle-button-en"; // Add a specific class for server button
            toggleServerButton.textContent = "EN"; // Set initial state.
            if (currentRegion === "Global") toggleServerButton.classList.add("selected");
            toggleServerButton.onclick = () => changeServer('Global');
            // Add the server toggle button
            serverSelection.appendChild(toggleServerButton);

            const toggleServerButtonJP = document.createElement("button");
            toggleServerButtonJP.className = "server-toggle-button-jp"; // Add a specific class for server button
            toggleServerButtonJP.textContent = "JP"; // Set initial state.
            if (currentRegion !== "Global") toggleServerButtonJP.classList.add("selected");
            toggleServerButtonJP.onclick = () => changeServer('Jp');
            // Add the server toggle button
            serverSelection.appendChild(toggleServerButtonJP);

            const infoPopopButton = document.createElement("button");
            infoPopopButton.className = "server-toggle-tooltip-button"; // Add a specific class for server button
            infoPopopButton.innerHTML = '<span style="display: inline-block; transform: rotate(90deg);">?</span>'
            infoPopopButton.classList.add("selected");
            // Add the server toggle button
            serverSelection.appendChild(infoPopopButton);

            const infoPopopMessage = document.createElement("div");
            // infoPopopButton.className = "server-toggle-button"; // Add a specific class for server button
            infoPopopMessage.className = "server-toggle-tooltip"
            infoPopopMessage.textContent = "Data is obtained from SchaleDB's API and is completely dependant on if the website is still alive and when and even if the owner makes the data available.";
            // Add the server toggle button
            serverSelection.appendChild(infoPopopMessage);


            // Create the language toggle button
            const toggleLangButton = document.createElement("button");
            toggleLangButton.className = "lang-toggle-button"; // Add a specific class for language button
            toggleLangButton.textContent = currentLang === 'en' ? "English" : "Japanese"; // Set initial state based on currentLang
            toggleLangButton.onclick = changeLanguage;

            // Add the language toggle button next to the server toggle button
            // serverSelection.appendChild(toggleLangButton);

            // Create a container for the toggles and the table
            const container = document.createElement("div");
            container.style.cssText = `
                display: flex;
                width: 100%;
            `;
            // container.style.flexDirection = "column";
            // container.style.width = "100%";
            container.appendChild(serverSelection);

            // Insert the container after DVDoomParent
            const dvDoomParent = document.getElementById("DVDoomParent");
            if (dvDoomParent) {
                dvDoomParent.parentNode.insertBefore(container, dvDoomParent.nextSibling);
            } else {
                document.body.appendChild(container);
            }

            // Initial load of data
            getCurrentGachaEventsRaids(currentRegion, currentLang);
        }

        // New function to change the language and reload data
        async function changeLanguage() {
            // Toggle language between 'en' and 'jp'
            currentLang = currentLang === 'en' ? 'jp' : 'en';

            // Save the language setting to localStorage
            localStorage.setItem("currentLang", currentLang);

            // Update button text immediately
            const toggleLangButton = document.querySelector('.lang-toggle-button'); // Target language button specifically
            if (toggleLangButton) {
                toggleLangButton.textContent = currentLang === 'en' ? "English" : "Japanese";
            }

            // Remove the existing table if it exists
            const serverToggle = document.querySelector('.server-toggle');
            if (serverToggle) {
                const existingTable = serverToggle.nextElementSibling;
                if (existingTable) {
                    existingTable.remove();
                }
            }

            // Reload the data with the updated language
            await getCurrentGachaEventsRaids(currentRegion, currentLang);
        }

        // Function to change the server and reload data
        async function changeServer(region = "Global") {
            timerIds.forEach(id => clearInterval(id));
            timerIds = []; // Reset the array after clearing

            // Toggle the region immediately
            currentRegion = region;

            // Save the current selection to localStorage
            localStorage.setItem("currentRegion", region);

            const toggleButtonEN = document.querySelector('.server-toggle-button-en'); // Target server button specifically
            const toggleButtonJP = document.querySelector('.server-toggle-button-jp'); // Target server button specifically

            if (currentRegion === 'Global') {
                toggleButtonEN.classList.add('selected');
                toggleButtonJP.classList.remove('selected');
            } else {
                toggleButtonEN.classList.remove('selected');
                toggleButtonJP.classList.add('selected');
            }

            // Remove the existing table if it exists
            document.getElementById('current-ba-info')?.remove();

            // Reload the data for the new server
            await getCurrentGachaEventsRaids(currentRegion, currentLang);
        }

        // Run the UI creation function
        createUI();
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// HOLE SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        let holeStyle = null;

        // Image caching logic
        const imageURLMap = {
            hole: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsAQMAAABDsxw2AAAABlBMVEX///////9VfPVsAAAAAnRSTlP/AOW3MEoAAAAJcEhZcwAAD2EAAA9hAag/p2kAAAF/SURBVGiB7dVBboMwEAVQIhYsOQIXicTRzNF8FB+BqhsWFdOm0DLpfJtRS9Ok+n8F8iMwHwhVxTAMwzAMwzD+RJeqJx+br/fPGSZXu41g1sigd3tJGaYvrhYZIWtFX1wngkdqRZ9VRF4gezs+6nPmWdI7MkPW64sOJbadRrIsqIXmwnC/QS30eXZZGNR2gaVls95ha/Ftnp1ka7TbYaInKLBlhpBny2Wn7YgSe79dzcoGwJa1SU1QYLOaoMBETQBZuy3JPovboHDSlaVt0NKvjTtsbWH6PKDI5urcOZh8lLbDpMz632ZA/Q0Ld8ysgv9vZLsMfoy+zeCH0jL42bUsAXXysdp30sbHWh/rfYUEy1C9VqF3AfSB/mogi4aB2lC/oDbUCGS2EdAuYh1itjjI7MvQI2b7/REbfCweytKhzNxUzMzdugUz9/4WzDxJmJlH5AHZcMcsHsqSkzXRw8bOx4KLPYmLPfvY10rIyMjIyMjIyMj+JWMYhmEYhmEeJK/GBmZ3tjvxfAAAAABJRU5ErkJggg=='
        };

        const imageCache = {};

        async function preloadImages() {
            if (window.location.hostname === "4chan.org") {
                const loadImageAsBase64 = async (url) => {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return new Promise((resolve) => {
                        resolve(window.URL.createObjectURL(blob));
                    });
                };

                for (const [key, url] of Object.entries(imageURLMap)) {
                    imageCache[key] = await loadImageAsBase64(url);
                }
            } else {
                Object.assign(imageCache, imageURLMap);
            }
        }

        // Options for the observer (which mutations to observe)
        const config = {
            attributes: false,
            childList: true,
            subtree: false
        };

        // Callback on hover
        function detectHover(hoverEvent) {
            hoverEvent.target.classList.add('seia-hovered');
        }

        // Callback function to execute when mutations are observed
        const callback = function (mutationsList, observer) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((addedNode) => {
                        if (!addedNode.classList.contains('noFile') && addedNode.classList.contains('postContainer')) {
                            const img = addedNode.querySelector('a.fileThumb > img');
                            if (img) {
                                img.onmouseover = detectHover;
                            }
                        }
                    });
                }
            }
        };

        // Create an observer instance linked to the callback function
        const observer = new MutationObserver(callback);

        async function alternateHole() {
            const holeButton = document.getElementById('holeButton');
            if (holeStyle) {
                // Remove the element
                holeStyle.remove();
                holeStyle = null;
                holeButton.style.color = null;
                holeButton.style.fontWeight = null;
                // Disconnect the observer
                observer.disconnect();
            } else {
                // Ensure images are preloaded
                await preloadImages();

                // Create the element
                holeStyle = document.createElement('style');
                holeStyle.textContent = `
                    a.fileThumb, a.imgLink > :first-child {
                    overflow: hidden;
                    }
                    a.fileThumb img:not(.full-image):not(.expanded-thumb):not(.seia-hovered), a.imgLink > :first-child:not(.seia-hovered) {
                    -webkit-mask: url("${imageCache.hole}");
                    -webkit-mask-repeat: no-repeat;
                    -webkit-mask-size: cover;
                    -webkit-mask-position: center;
                    }
                `;
                document.head.appendChild(holeStyle);

                // Apply to existing images
                document.querySelectorAll('.postContainer:not(.noFile), .panelUploads').forEach((container) => {
                    const img = container.querySelector('a.fileThumb > img, a.imgLink > :first-child');
                    if (img) {
                        img.onmouseover = detectHover;
                    }
                });

                // Apply to OP's image
                const opImg = document.querySelector('.postContainer.opContainer a.fileThumb > img, .innerOP a.imgLink > :first-child');
                if (opImg) {
                    opImg.classList.add('seia-hovered');
                }

                holeButton.style.color = 'red';
                holeButton.style.fontWeight = 'bold';

                // Start observing the target node for configured mutations
                const targetNode = document.querySelector('.thread');
                if (targetNode) {
                    observer.observe(targetNode, config);
                }
            }
        }

        // Create and add the "Hole" button
        function addHoleButton() {
            const navLinks = document.querySelector(".navLinks.desktop, .opCell > :first-child");
            if (navLinks) {
                const holeButtonSpan = document.createElement('span');
                holeButtonSpan.style.float = 'right';
                holeButtonSpan.style.marginRight = '5px';
                holeButtonSpan.style.marginTop = '5px';
                holeButtonSpan.innerHTML = ' [<a id="holeButton" style="cursor: pointer;">Hole</a>] ';
                holeButtonSpan.querySelector('#holeButton').onclick = alternateHole;
                navLinks.appendChild(holeButtonSpan);
            }
        }

        // Initialize the hole functionality
        addHoleButton();
    })();

    //////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////////// RADIO SECTION ////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    await (async function () {
        'use strict';

        if (!/^bag\/|\/bag\/|Blue Archive|BIue Archive/.test(document?.querySelector('.postInfo.desktop .subject, .opHead .labelSubject')?.textContent?.trim() ?? '')) return;

        if (typeof GM_info === 'undefined') return;

        const processAudioResponse = function() {
            if (window.location.hostname === "4chan.org") {
                return function(response) {
                    const blob = new Blob([response.response], {
                        type: 'audio/ogg'
                    });
                    return URL.createObjectURL(blob);
                };
            } else {
                return function(response) {
                    const binary = Array.from(new Uint8Array(response.response))
                        .map(byte => String.fromCharCode(byte))
                        .join('');
                    const base64 = btoa(binary);
                    return `data:audio/ogg;base64,${base64}`;
                };
            }
        }();

        const outerStyle = document.createElement('style');
        outerStyle.textContent = `
            .shortcut.brackets-wrap .seia-radio-button {
              display: inline-block;
              width: 14px;
              height: 14px;
              -webkit-mask-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAYAAAA+s9J6AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAG4ElEQVR4nO3d3ZaiyBaF0cge5/1fOc+V3ZaliD/E2juY865qmIIQnwEmJj+/v78DyPknvQJwdiKEMBFCmAghTIQQJkIIEyGEiRDCRAhhIoQwEUKYCCFMhBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyFnUfYegP9LrwAc6Da8y79/Zq/IFhGyorKz3j0iZBWtwrvmnJDufsfrAZYK1kxIR6Ui+pQI6eLb4f2OIh/QiJDqlpr17hEhFc0Kr8RsKEIqWX7Wu0eEpJ0yvGsiJOH04V0TITOJ7w4RcrSq4cU/kLkQIUcR304i5JuE9wYR8inhfUiEvEt8XyJCXiG8A4iQPSrG1zq8ayLkkYrhjbFQfBci5JrwAkTIGDXjWzq8ayI8r4rhjXGi+C5EeC7CK0iE51AxvlOHd02E66oY3hji+4sI11MxPuFtEOEahNeYCHsT3wJE2I/wFiPCHoS3MBHWJr4TEGE9wjsZEdYgvBMTYZb4EGGA8PiDCOepFp/wihDhsaqFN4b4yhHh9wmPl4jwe6rFJ7wmRPiZauGNIb52RPieavEJrzER7ic8DiHCbdXCG0N8yxHhfdXiE97CRPgf4REhQvERdtYIhUcZZ4pQeJR0hgjFR2mrRig82lgtwkrxCY9dVoiwUnhjiI8XdY1QeCyjW4SV4hMeX9EtQgOf5fyTXgE4OxFCmAghrOo5YaUPYFhHyc8UqkQoOma4HWclokxGKDzSLmMwGmPqnFCAVPI7gmMyEaEAqSoyNmdHKECqmz5GZ0YoQLqYOlZnRShAupk2ZmdEKEDY4IoZeGzKBCJCCDs6Qoei8ISZELYdPpGIEMJECGFHRuh8EHYwE0KYCCFMhBBW5Zv1aVtf6ux6blviW+NFlN6HZ4zw1cF57/Gld+oQ4K2fUXifnSXCbw/K6+cru3PpYfUIZ8wIl2WIkbesGuG78V2H9O5ha8UYK67T0dockq8W4d4Nv2dQPnrMs2VUjpGCVorwWRzfimLvbFn6wwDqWCHCWfFtPfejdRAiT3WPsMrv97ZidHjKps5XzDwKMPmHXLeW2+aDAubqGuFWgGlbbwJC5C8dI6wc4DUhsku3CLsEeFF1vSikW4T3VB/o99bPbMi/OkXY8ULqCyHyUJcIOwcIm7pEuAKzIXd1iHClWVCI/KVDhLe6Bgh3VY9wxVnCbMgfqkd4yyzIcipHuPLs4M2Ef1WO8NbqA3flNx02dP8qU2e/Y154Ai+s00wIS6oaoXduTqNqhLdWPx+88OZzjNLjxzlh1lHnhaUHHX/qMhPCskQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRJjlMjXaRHiWwepysxOqGqHByGlUjRBOQ4Q5ZznE5olOX2Va/dbTM17bjDsbz7hzVre7c22qHOHMv8Ey2+zXtWd5n97W+9kyvnHb8BnLmK7b4eiqUR7p1W32zjZ+5Wd+3ljGqz/TapxUj7DVO9pOM++t8e5gnDHg9/7cjNcQVflw9JHVzw2/5ZXzpnuP3bOd9y7j0eM+2Zd7ltFirFSfCcdY694N6TtMPVrWO+vw6LXce65H/z9jGeXHSocIV5E+DH22rE8H8J7X8soy3t1e5We+W10ibPkOV8jegbn3cZ9s+0QkpcdKlwjH6B1i+jB0Ba9sr1bbtlOEj1QPsXuAe7Zvp9dTTrcIH+3sqiFWXa9XCOxg3SIco0+IS11a9US1bd9KxwjHqB3i1tUdqwR45KVn3/i5CuNgt64RjrEdYmonzLhA+h1HX53y6c/e883tVfrNr3OEY2xv3JkxPpv9Zg+Cdz5JnvEB0qfLeOVC9Da6RzjGvkurjtoxz5672jvwo/V9Z/s8Cv3R86eWUW0f/OXn9/ewdaz8S9kZ5zQVdv6MX6ofvYwKFwYcOruuFuHFN991v/E8STNew9HLSO8HEb5p9rlB+vVu+fY1oJ8so+NRyKFjqeNXmfa63hFHbsTK8V1c1vHI89dny/jGdpqxjOlWjvDat4NsubPHnPVeZRnTnCXCa3u/cPro8fBVZ4zwlsiIWuH3hNDakRG2u3IBEsyEECZCCBMhbDv8tOroCJ0XwhNmQgibEaHZkK6mjF0zIdw3bfKYFaHZEB6YORMKkS6mjtXZh6NCpLrpYzRxTihEKor9lb7UBzPJP0sIt6JjMf1Vppb3GGcJZSaBdIQXZTYIzOb3hBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRAhhIoQwEUKYCCFMhBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCPs/RWX6VM07M7UAAAAASUVORK5CYII=);
              -webkit-mask-size: contain;
              -webkit-mask-repeat: no-repeat;
              mask-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAYAAAA+s9J6AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAG4ElEQVR4nO3d3ZaiyBaF0cge5/1fOc+V3ZaliD/E2juY865qmIIQnwEmJj+/v78DyPknvQJwdiKEMBFCmAghTIQQJkIIEyGEiRDCRAhhIoQwEUKYCCFMhBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyFnUfYegP9LrwAc6Da8y79/Zq/IFhGyorKz3j0iZBWtwrvmnJDufsfrAZYK1kxIR6Ui+pQI6eLb4f2OIh/QiJDqlpr17hEhFc0Kr8RsKEIqWX7Wu0eEpJ0yvGsiJOH04V0TITOJ7w4RcrSq4cU/kLkQIUcR304i5JuE9wYR8inhfUiEvEt8XyJCXiG8A4iQPSrG1zq8ayLkkYrhjbFQfBci5JrwAkTIGDXjWzq8ayI8r4rhjXGi+C5EeC7CK0iE51AxvlOHd02E66oY3hji+4sI11MxPuFtEOEahNeYCHsT3wJE2I/wFiPCHoS3MBHWJr4TEGE9wjsZEdYgvBMTYZb4EGGA8PiDCOepFp/wihDhsaqFN4b4yhHh9wmPl4jwe6rFJ7wmRPiZauGNIb52RPieavEJrzER7ic8DiHCbdXCG0N8yxHhfdXiE97CRPgf4REhQvERdtYIhUcZZ4pQeJR0hgjFR2mrRig82lgtwkrxCY9dVoiwUnhjiI8XdY1QeCyjW4SV4hMeX9EtQgOf5fyTXgE4OxFCmAghrOo5YaUPYFhHyc8UqkQoOma4HWclokxGKDzSLmMwGmPqnFCAVPI7gmMyEaEAqSoyNmdHKECqmz5GZ0YoQLqYOlZnRShAupk2ZmdEKEDY4IoZeGzKBCJCCDs6Qoei8ISZELYdPpGIEMJECGFHRuh8EHYwE0KYCCFMhBBW5Zv1aVtf6ux6blviW+NFlN6HZ4zw1cF57/Gld+oQ4K2fUXifnSXCbw/K6+cru3PpYfUIZ8wIl2WIkbesGuG78V2H9O5ha8UYK67T0dockq8W4d4Nv2dQPnrMs2VUjpGCVorwWRzfimLvbFn6wwDqWCHCWfFtPfejdRAiT3WPsMrv97ZidHjKps5XzDwKMPmHXLeW2+aDAubqGuFWgGlbbwJC5C8dI6wc4DUhsku3CLsEeFF1vSikW4T3VB/o99bPbMi/OkXY8ULqCyHyUJcIOwcIm7pEuAKzIXd1iHClWVCI/KVDhLe6Bgh3VY9wxVnCbMgfqkd4yyzIcipHuPLs4M2Ef1WO8NbqA3flNx02dP8qU2e/Y154Ai+s00wIS6oaoXduTqNqhLdWPx+88OZzjNLjxzlh1lHnhaUHHX/qMhPCskQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRJjlMjXaRHiWwepysxOqGqHByGlUjRBOQ4Q5ZznE5olOX2Va/dbTM17bjDsbz7hzVre7c22qHOHMv8Ey2+zXtWd5n97W+9kyvnHb8BnLmK7b4eiqUR7p1W32zjZ+5Wd+3ljGqz/TapxUj7DVO9pOM++t8e5gnDHg9/7cjNcQVflw9JHVzw2/5ZXzpnuP3bOd9y7j0eM+2Zd7ltFirFSfCcdY694N6TtMPVrWO+vw6LXce65H/z9jGeXHSocIV5E+DH22rE8H8J7X8soy3t1e5We+W10ibPkOV8jegbn3cZ9s+0QkpcdKlwjH6B1i+jB0Ba9sr1bbtlOEj1QPsXuAe7Zvp9dTTrcIH+3sqiFWXa9XCOxg3SIco0+IS11a9US1bd9KxwjHqB3i1tUdqwR45KVn3/i5CuNgt64RjrEdYmonzLhA+h1HX53y6c/e883tVfrNr3OEY2xv3JkxPpv9Zg+Cdz5JnvEB0qfLeOVC9Da6RzjGvkurjtoxz5672jvwo/V9Z/s8Cv3R86eWUW0f/OXn9/ewdaz8S9kZ5zQVdv6MX6ofvYwKFwYcOruuFuHFN991v/E8STNew9HLSO8HEb5p9rlB+vVu+fY1oJ8so+NRyKFjqeNXmfa63hFHbsTK8V1c1vHI89dny/jGdpqxjOlWjvDat4NsubPHnPVeZRnTnCXCa3u/cPro8fBVZ4zwlsiIWuH3hNDakRG2u3IBEsyEECZCCBMhbDv8tOroCJ0XwhNmQgibEaHZkK6mjF0zIdw3bfKYFaHZEB6YORMKkS6mjtXZh6NCpLrpYzRxTihEKor9lb7UBzPJP0sIt6JjMf1Vppb3GGcJZSaBdIQXZTYIzOb3hBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCBMhhIkQwkQIYSKEMBFCmAghTIQQJkIIEyGEiRDCRAhhIoQwEUKYCCFMhBAmQggTIYSJEMJECGEihDARQpgIIUyEECZCCPs/RWX6VM07M7UAAAAASUVORK5CYII=);
              mask-size: contain;
              mask-repeat: no-repeat;
              background-color: currentColor;
              vertical-align: middle;
            }
        `;
        document.head.appendChild(outerStyle);

        class SynchronizedPlayer {
            constructor(playlist) {
                this.playlist = playlist;
                this.audio = new Audio();
                this.isPlaying = false;
                this.currentTrackBlob = null;
                this.nextTrackTimeout = null;
                this.previousVolume = 0.5;
                this.isMuted = false;
                this.audio.volume = this.previousVolume;
                this.playlistDuration = playlist.reduce((acc, track) => acc + track.duration, 0);
                this.baseDate = new Date('2024-01-01T00:00:00Z').getTime();
                this.nextTrackBlob = null;
                this.preloadTimeout = null;
            }

            async preloadNextTrack() {
                try {
                    const nextTrack = this.getNextTrackInfo();
                    if (this.nextTrackBlob) {
                        URL.revokeObjectURL(this.nextTrackBlob);
                    }
                    this.nextTrackBlob = await this.loadAudio(nextTrack.url);
                } catch (error) {
                    this.nextTrackBlob = null;
                }
            }

            getNextTrackInfo() {
                const {
                    iteration,
                    position,
                    shuffledPlaylist
                } = this.getCurrentPlaylistInfo();
                let accumulated = 0;
                let currentTrackIndex = 0;
                for (let i = 0; i < shuffledPlaylist.length; i++) {
                    accumulated += shuffledPlaylist[i].duration;
                    if (position < accumulated) {
                        currentTrackIndex = i;
                        break;
                    }
                }
                if (currentTrackIndex === shuffledPlaylist.length - 1) {
                    const nextIteration = iteration + 1;
                    const nextShuffledPlaylist = this.getShuffledPlaylist(nextIteration);
                    return nextShuffledPlaylist[0];
                } else {
                    return shuffledPlaylist[currentTrackIndex + 1];
                }
            }

            async loadAudio(url) {
                if (!url.endsWith('.ogg')) {
                    throw new Error('Invalid audio format');
                }
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        responseType: 'arraybuffer',
                        headers: {
                            'Accept': 'audio/ogg'
                        },
                        onload: (response) => {
                            if (response.status === 200) {
                                resolve(processAudioResponse(response));
                            } else {
                                reject(new Error(`Failed to load: ${response.status}`));
                            }
                        },
                        onerror: reject
                    });
                });
            }

            getCurrentPlaylistInfo() {
                const now = Date.now();
                const timeSinceBase = now - this.baseDate;
                const iteration = Math.floor(timeSinceBase / this.playlistDuration);
                const position = timeSinceBase % this.playlistDuration;
                return {
                    iteration,
                    position,
                    shuffledPlaylist: this.getShuffledPlaylist(iteration)
                };
            }

            getShuffledPlaylist(iteration) {
                const seededRandom = this.createSeededRandom(iteration);
                return this.shufflePlaylist(this.playlist.slice(), seededRandom);
            }

            getTrackPosition(shuffledPlaylist, position) {
                let accumulated = 0;
                for (let i = 0; i < shuffledPlaylist.length; i++) {
                    const track = shuffledPlaylist[i];
                    if (position < accumulated + track.duration) {
                        return {
                            track,
                            offset: position - accumulated,
                            remaining: track.duration - (position - accumulated)
                        };
                    }
                    accumulated += track.duration;
                }
                return {
                    track: shuffledPlaylist[0],
                    offset: 0,
                    remaining: shuffledPlaylist[0].duration
                };
            }

            async play() {
                if (this.isPlaying) return;
                this.isPlaying = true;
                if (this.onStateChange) this.onStateChange(true);
                await this.playCurrentTrack();
            }

            stop() {
                this.isPlaying = false;
                this.audio.pause();
                if (this.onStateChange) this.onStateChange(false);
                if (this.currentTrackBlob) {
                    URL.revokeObjectURL(this.currentTrackBlob);
                    this.currentTrackBlob = null;
                }
                if (this.nextTrackBlob) {
                    URL.revokeObjectURL(this.nextTrackBlob);
                    this.nextTrackBlob = null;
                }
                if (this.nextTrackTimeout) {
                    clearTimeout(this.nextTrackTimeout);
                    this.nextTrackTimeout = null;
                }
                if (this.preloadTimeout) {
                    clearTimeout(this.preloadTimeout);
                    this.preloadTimeout = null;
                }
            }

            async playCurrentTrack() {
                if (!this.isPlaying) return;

                const {
                    iteration,
                    position,
                    shuffledPlaylist
                } = this.getCurrentPlaylistInfo();
                const {
                    track,
                    offset,
                    remaining
                } = this.getTrackPosition(shuffledPlaylist, position);

                try {
                    let currentTrackBlob;

                    // Check if this is the preloaded track
                    if (this.nextTrackBlob && track === this.getNextTrackInfo()) {
                        currentTrackBlob = this.nextTrackBlob;
                        this.nextTrackBlob = null;
                    } else {
                        if (this.currentTrackBlob) {
                            URL.revokeObjectURL(this.currentTrackBlob);
                        }
                        currentTrackBlob = await this.loadAudio(track.url);
                    }

                    this.currentTrackBlob = currentTrackBlob;
                    this.audio.src = this.currentTrackBlob;

                    await new Promise(resolve => {
                        this.audio.addEventListener('loadedmetadata', resolve, {
                            once: true
                        });
                    });

                    this.audio.currentTime = offset / 1000;
                    await this.audio.play();

                    if (this.nextTrackTimeout) {
                        clearTimeout(this.nextTrackTimeout);
                    }

                    if (this.preloadTimeout) {
                        clearTimeout(this.preloadTimeout);
                    }
                    this.preloadTimeout = setTimeout(() => {
                        this.preloadNextTrack();
                    }, remaining * 0.8);

                    this.nextTrackTimeout = setTimeout(() => {
                        if (this.isPlaying) {
                            this.playCurrentTrack();
                        }
                    }, remaining);

                } catch (error) {
                    setTimeout(() => {
                        if (this.isPlaying) {
                            this.playCurrentTrack();
                        }
                    }, 1000);
                }
            }

            createSeededRandom(seed) {
                return () => {
                    seed = (seed * 16807) % 2147483647;
                    return (seed - 1) / 2147483646;
                };
            }

            shufflePlaylist(playlist, seededRandom) {
                for (let i = playlist.length - 1; i > 0; i--) {
                    const j = Math.floor(seededRandom() * (i + 1));
                    [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
                }
                return playlist;
            }

            getCurrentPlaybackInfo() {
                const {
                    iteration,
                    position,
                    shuffledPlaylist
                } = this.getCurrentPlaylistInfo();
                const {
                    track,
                    offset
                } = this.getTrackPosition(shuffledPlaylist, position);
                return {
                    track,
                    timestamp: offset
                };
            }
        }

        let isMinimized = false;
        let minimizedPlayer = null;

        class PlayerUI {
            constructor(playlist, existingPlayer = null) {
                this.player = existingPlayer || new SynchronizedPlayer(playlist);
                this.updateInterval = null;
                this.player.onStateChange = (isPlaying) => {
                    if (isPlaying) {
                        this.playButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg>`;
                    } else {
                        this.playButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                    }
                };
                this.createUI();
                if (existingPlayer && existingPlayer.audio) {
                    this.volumeLevel.style.width = `${existingPlayer.audio.volume * 100}%`;
                } else {
                    this.player.audio.volume = 0.5;
                    this.volumeLevel.style.width = '50%';
                }
            }

            colorToRGBA(color, opacity = 0.95) {
                const temp = document.createElement('div');
                temp.style.color = color;
                document.body.appendChild(temp);
                const computedColor = window.getComputedStyle(temp).color;
                document.body.removeChild(temp);
                const match = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                if (match) {
                    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
                }
                return `rgba(0, 0, 0, ${opacity})`;
            }

            syncColors() {
                const htmlStyle = window.getComputedStyle(document.documentElement);
                const bodyStyle = window.getComputedStyle(document.body);
                const textColor = htmlStyle.color !== 'rgba(0, 0, 0, 0)' ? htmlStyle.color : bodyStyle.color;
                const backgroundColor = htmlStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ? htmlStyle.backgroundColor : bodyStyle.backgroundColor;
                const wrapper = document.querySelector('.video-controls-wrapper');
                const controls = document.querySelector('.controls');
                const textElements = wrapper.querySelectorAll('.video-title, .time, button, svg');
                wrapper.style.backgroundColor = this.colorToRGBA(backgroundColor, 0.95);
                controls.style.backgroundColor = this.colorToRGBA(backgroundColor, 0.3);
                wrapper.style.border = `1px solid ${this.colorToRGBA(textColor, 0.3)}`;
                textElements.forEach(element => {
                    element.style.color = textColor;
                    if (element.tagName.toLowerCase() === 'svg') {
                        element.style.stroke = textColor;
                    }
                });
                const bars = wrapper.querySelectorAll('.progress, .volume-slider');
                bars.forEach(bar => {
                    bar.style.background = this.colorToRGBA(textColor, 0.2);
                });
                const indicators = wrapper.querySelectorAll('.progress-bar, .volume-level');
                indicators.forEach(indicator => {
                    indicator.style.background = textColor;
                });
            }

            updateVolumeButtonIcon(isMuted) {
                if (isMuted) {
                    this.volumeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                </svg>`;
                } else {
                    this.volumeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>`;
                }
            }

            createUI() {
                const style = document.createElement('style');
                style.textContent = `
              .video-controls-wrapper * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                  font-family: system-ui, -apple-system, sans-serif;
              }
              .video-controls-wrapper {
                  position: fixed;
                  bottom: 14px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 63%;
                  max-width: 560px;
                  z-index: 9999;
                  height: auto;
                  border-radius: 6px;
                  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06);
                  backdrop-filter: blur(7px);
                  border: 1px solid transparent;
              }
              .controls-container {
                  width: 100%;
                  padding: 2px;
                  position: relative;
              }
              .video-title {
                  font-size: 12px;
                  margin-bottom: 2px;
                  padding: 0 3px;
                  padding-right: 28px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
              }
              .controls {
                  padding: 2px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  border-radius: 4px;
                  height: 34px;
              }
              .controls button {
                  background: transparent;
                  border: none;
                  min-width: 22px;
                  width: 22px;
                  height: 22px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  opacity: 0.9;
                  transition: opacity 0.2s;
                  padding: 0;
                  flex-shrink: 0;
              }
              .controls button:hover { opacity: 1; }
              .control-buttons {
                  position: absolute;
                  top: 0;
                  right: 0;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  padding-right: 3px;
              }
              .minimize-button, .close-button {
                  width: 22px;
                  height: 22px;
                  opacity: 0.7;
                  transition: opacity 0.2s;
                  cursor: pointer;
                  padding: 3px;
                  border: none;
                  background: transparent;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .minimize-button:hover, .close-button:hover { opacity: 1; }
              .video-title { padding-right: 52px !important; }
              .progress {
                  flex: 1;
                  height: 3px;
                  border-radius: 1.5px;
                  position: relative;
                  min-width: 70px;
              }
              .progress-bar {
                  position: absolute;
                  left: 0;
                  top: 0;
                  height: 100%;
                  border-radius: 1.5px;
              }
              .time {
                  font-size: 12px;
                  min-width: 63px;
                  text-align: center;
                  flex-shrink: 0;
              }
              .volume-control {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  position: relative;
              }
              .volume-slider {
                  width: 56px;
                  height: 3px;
                  border-radius: 1.5px;
                  position: relative;
                  cursor: pointer;
              }
              .volume-level {
                  position: absolute;
                  left: 0;
                  top: 0;
                  height: 100%;
                  border-radius: 1.5px;
                  width: 50%;
                  pointer-events: none;
              }
              @media (max-width: 640px) {
                  .video-controls-wrapper {
                      bottom: 7px;
                      width: 66.5%;
                  }
                  .volume-slider { width: 42px; }
                  .controls {
                      gap: 6px;
                      padding: 6px;
                  }
                  .time {
                      min-width: 56px;
                      font-size: 11px;
                  }
              }
          `;
                document.head.appendChild(style);

                const playerHTML = `<div class="video-controls-wrapper"><div class="controls-container"><h2 class="video-title">Now Playing...</h2>
              <div class="control-buttons">
                  <button class="minimize-button" aria-label="Minimize">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                  </button>
                  <button class="close-button" aria-label="Close">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                  </button>
              </div>
              <div class="controls"><button id="playPauseBtn" aria-label="Play"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button><div class="progress"><div class="progress-bar"></div></div><div class="time">0:00 / 0:00</div><div class="volume-control"><button id="volumeBtn" aria-label="Volume"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg></button><div class="volume-slider" id="volumeSlider"><div class="volume-level" id="volumeLevel"></div></div></div></div></div></div>`;

                document.body.insertAdjacentHTML('beforeend', playerHTML);

                this.container = document.querySelector('.video-controls-wrapper');
                this.titleElement = document.querySelector('.video-title');
                this.playButton = document.querySelector('#playPauseBtn');
                this.progressBar = document.querySelector('.progress-bar');
                this.timeDisplay = document.querySelector('.time');
                this.volumeLevel = document.querySelector('.volume-level');
                this.volumeSlider = document.querySelector('#volumeSlider');
                this.closeButton = document.querySelector('.close-button');
                this.volumeButton = document.querySelector('#volumeBtn');

                this.volumeLevel.style.width = `${this.player.audio.volume * 100}%`;
                this.updateVolumeButtonIcon(this.player.isMuted);

                this.volumeButton.onclick = () => {
                    if (this.player.isMuted) {
                        this.player.audio.volume = this.player.previousVolume;
                        this.volumeLevel.style.width = `${this.player.previousVolume * 100}%`;
                        this.updateVolumeButtonIcon(false);
                    } else {
                        this.player.previousVolume = this.player.audio.volume;
                        this.player.audio.volume = 0;
                        this.volumeLevel.style.width = '0%';
                        this.updateVolumeButtonIcon(true);
                    }
                    this.player.isMuted = !this.player.isMuted;
                };

                const updateVolume = (e) => {
                    const rect = this.volumeSlider.getBoundingClientRect();
                    let volume = (e.clientX - rect.left) / rect.width;
                    volume = Math.max(0, Math.min(1, volume));
                    this.volumeLevel.style.width = `${volume * 100}%`;
                    this.player.audio.volume = volume;
                    if (volume > 0 && this.player.isMuted) {
                        this.player.isMuted = false;
                        this.updateVolumeButtonIcon(false);
                    }
                    this.player.previousVolume = volume;
                };
                this.syncColors();

                const observer = new MutationObserver(() => this.syncColors());
                observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
                observer.observe(document.body, {
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });

                const minimizeButton = document.querySelector('.minimize-button');
                minimizeButton.onclick = () => {
                    isMinimized = true;
                    minimizedPlayer = this.player;
                    if (this.updateInterval) {
                        clearInterval(this.updateInterval);
                        this.updateInterval = null;
                    }
                    this.container.remove();
                };

                this.closeButton.onclick = () => {
                    this.container.style.display = 'none';
                    this.player.stop();
                };

                let isDragging = false;

                this.volumeSlider.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    updateVolume(e);
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDragging) updateVolume(e);
                });

                document.addEventListener('mouseup', () => {
                    isDragging = false;
                });

                this.volumeSlider.addEventListener('click', updateVolume);

                this.playButton.onclick = () => {
                    if (!this.player.isPlaying) {
                        this.player.play();
                    } else {
                        this.player.stop();
                    }
                };
                this.updateInterval = setInterval(() => {
                    if (this.player.isPlaying) {
                        const {
                            track,
                            timestamp
                        } = this.player.getCurrentPlaybackInfo();
                        const progress = (timestamp / track.duration) * 100;
                        this.progressBar.style.width = `${progress}%`;
                        const currentTime = Math.floor(timestamp / 1000);
                        const totalTime = Math.floor(track.duration / 1000);
                        const currentMin = Math.floor(currentTime / 60);
                        const currentSec = currentTime % 60;
                        const totalMin = Math.floor(totalTime / 60);
                        const totalSec = totalTime % 60;
                        this.timeDisplay.textContent = `${currentMin}:${currentSec.toString().padStart(2, '0')} / ${totalMin}:${totalSec.toString().padStart(2, '0')}`;
                        this.titleElement.textContent = track.title;
                    }
                }, 1000);
            }
        }

        function parseTrackInfo(htmlString) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            const tracks = [];
            const trackDiv = doc.querySelector('.track');
            let mainTitle = '';
            if (trackDiv) {
                const titleSpan = trackDiv.querySelector('.title');
                const audioElement = trackDiv.querySelector('audio');
                if (titleSpan && audioElement) {
                    mainTitle = titleSpan.textContent.trim().replace(/\s*:+\s*$/, '');
                    const sourceElement = audioElement.querySelector('source');
                    if (sourceElement && sourceElement.getAttribute('src').endsWith('.ogg')) {
                        tracks.push({
                            title: mainTitle,
                            duration: parseInt(audioElement.getAttribute('data-durationhint')) * 1000,
                            url: formatUrl(sourceElement.getAttribute('src'))
                        });
                    }
                }
            }
            const variantsContent = doc.querySelector('.mw-collapsible-content');
            if (variantsContent) {
                const variantAudios = variantsContent.querySelectorAll('audio');
                variantAudios.forEach(audio => {
                    const titleDiv = audio.closest('div[style*="width:fit-content"]')?.previousElementSibling;
                    if (titleDiv) {
                        const variantName = titleDiv.textContent.trim().replace(/\s*:+\s*$/, '');
                        if (variantName.includes("1.5-Year Anniversary Festival: Sound Archive Live!")) return;
                        const sourceElement = audio.querySelector('source');
                        if (sourceElement && sourceElement.getAttribute('src').endsWith('.ogg')) {
                            tracks.push({
                                title: `${mainTitle} - ${variantName}`,
                                duration: parseInt(audio.getAttribute('data-durationhint')) * 1000,
                                url: formatUrl(sourceElement.getAttribute('src'))
                            });
                        }
                    }
                });
            }
            return tracks;
        }

        function formatUrl(url) {
            if (url && url.startsWith('//')) return 'https:' + url;
            if (url && !url.startsWith('http')) return 'https://' + url;
            return url;
        }

        async function fetchAndParseTracks(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function (response) {
                        if (response.status === 200) {
                            try {
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(response.responseText, 'text/html');
                                const trackBlocks = doc.querySelectorAll('.track.track-standalone');
                                const allTracks = [];
                                trackBlocks.forEach(trackBlock => {
                                    const trackInfo = parseTrackInfo(trackBlock.outerHTML);
                                    allTracks.push(...trackInfo);
                                });
                                resolve(allTracks);
                            } catch (error) {
                                reject(error);
                            }
                        } else {
                            reject(new Error(`HTTP error! status: ${response.status}`));
                        }
                    },
                    onerror: reject
                });
            });
        }

        let activePlayer = null;

        async function initializeMusicPlayer() {
            if (activePlayer && !isMinimized) return;
            try {
                if (isMinimized && minimizedPlayer) {
                    const playerUI = new PlayerUI(minimizedPlayer.playlist, minimizedPlayer);
                    activePlayer = playerUI;
                    const volumeLevel = document.querySelector('.volume-level');
                    if (minimizedPlayer.audio) {
                        volumeLevel.style.width = `${minimizedPlayer.audio.volume * 100}%`;
                    }
                    const closeButton = document.querySelector('.close-button');
                    closeButton.onclick = terminateMusicPlayer;
                    isMinimized = false;
                    minimizedPlayer = null;
                } else {
                    const tracks = await fetchAndParseTracks('https://bluearchive.wiki/wiki/Music');
                    if (!tracks || tracks.length === 0) throw new Error('No tracks found');
                    const playerUI = new PlayerUI(tracks);
                    const closeButton = document.querySelector('.close-button');
                    closeButton.onclick = terminateMusicPlayer;
                    activePlayer = playerUI;
                    activePlayer.player.play();
                }
            } catch (error) {
                terminateMusicPlayer();
            }
        }

        function terminateMusicPlayer() {
            if (!activePlayer) return;
            if (activePlayer.player) activePlayer.player.stop();
            if (activePlayer.player && activePlayer.player.audio) {
                activePlayer.player.audio.src = '';
                activePlayer.player.audio.load();
            }
            if (activePlayer.player && activePlayer.player.currentTrackBlob) {
                URL.revokeObjectURL(activePlayer.player.currentTrackBlob);
            }
            if (activePlayer.observer) activePlayer.observer.disconnect();
            if (activePlayer.volumeSlider) {
                activePlayer.volumeSlider.removeEventListener('mousedown', activePlayer.volumeSlider.onmousedown);
                activePlayer.volumeSlider.removeEventListener('click', activePlayer.volumeSlider.onclick);
            }
            document.removeEventListener('mousemove', document.onmousemove);
            document.removeEventListener('mouseup', document.onmouseup);
            const wrapper = document.querySelector('.video-controls-wrapper');
            if (wrapper) wrapper.remove();
            activePlayer = null;
            isMinimized = false;
            minimizedPlayer = null;
        }

        if (document.getElementById('shortcuts')) {
            const shortcuts = document.getElementById('shortcuts');
            const shortcutChildren = shortcuts.children;
            const lastElement = shortcutChildren[shortcutChildren.length - 1];

            const seiaRadioButtonElement = document.createElement('span');
            seiaRadioButtonElement.id = 'shortcut-radio-seia';
            seiaRadioButtonElement.className = 'shortcut brackets-wrap';
            seiaRadioButtonElement.innerHTML = `<a href="javascript:;" title="Radio"><span class="seia-radio-button"></span></a>`;
            shortcuts.insertBefore(seiaRadioButtonElement, lastElement);
            seiaRadioButtonElement.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                initializeMusicPlayer();
            });
        // Check if it's vanilla 4chan.
        } else if(document.getElementById('navtopright')){
            const navTopRight = document.getElementById('navtopright');
            if (navTopRight) {
                navTopRight.insertAdjacentHTML('afterbegin', ` [<a href="javascript:void(0);" id="seiaRadioLink">Radio</a>] `);
                const seiaRadioButtonElement = document.getElementById('seiaRadioLink');
                if (seiaRadioButtonElement) {
                    seiaRadioButtonElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        initializeMusicPlayer();
                    });
                }
            }
        } else if (document.getElementById('navLinkSpan')) {
            const navHeader = document.getElementById('navLinkSpan').parentNode;

            let navOptionsSeiaSpan = document.getElementById('navOptionsSeiaSpan');
            if (!navOptionsSeiaSpan) {
                navOptionsSeiaSpan = document.createElement('span');
                navOptionsSeiaSpan.id = 'navOptionsSeiaSpan';
                navOptionsSeiaSpan.innerHTML = ' <span>|</span>'
                navHeader.appendChild(navOptionsSeiaSpan);
            }

            const seiaRadioButtonElement = document.createElement('span');
            seiaRadioButtonElement.id = 'shortcut-radio-seia';
            seiaRadioButtonElement.className = 'shortcut brackets-wrap';
            seiaRadioButtonElement.innerHTML = ` <a href="javascript:;" title="Radio"><span class="seia-radio-button"></span></a> |`;
            navOptionsSeiaSpan.appendChild(seiaRadioButtonElement);

            seiaRadioButtonElement.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                initializeMusicPlayer();
            });
        // Assume it's classic LynxChan.
        } else {
            // Classic LynxChan
            const navTopRight = document.getElementsByClassName('innerUtility top')[0];
            if (navTopRight) {
                // Insert before the last bracket
                navTopRight.insertAdjacentHTML('afterbegin', `[<a href="javascript:void(0);" id="seiaRadioLink">Radio</a>] `);
                const seiaRadioButtonElement = document.getElementById('seiaMenuLink');
                if (seiaRadioButtonElement) {
                    seiaRadioButtonElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        initializeMusicPlayer();
                    });
                }
            }
        }

    })();
})();
