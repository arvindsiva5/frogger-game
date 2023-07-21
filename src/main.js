"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
function main() {
    /**
     * Inside this function you will use the classes and functions from rx.js
     * to add visuals to the svg element in pong.html, animate them, and make them interactive.
     *
     * Study and complete the tasks in observable examples first to get ideas.
     *
     * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
     *
     * You will be marked on your functional programming style
     * as well as the functionality that you implement.
     *
     * Document your code!
     */
    /**
     * This is the view for your game to add and update your game elements.
     */
    const svg = document.querySelector("#svgCanvas");
    // Example on adding an element
    const circle = document.createElementNS(svg.namespaceURI, "circle");
    circle.setAttribute("r", "50");
    circle.setAttribute("cx", "250");
    circle.setAttribute("cy", "550");
    circle.setAttribute("style", "fill: green; stroke: green; stroke-width: 1px;");
    circle.id = "circ";
    svg.appendChild(circle);
    const circ = document.getElementById("circ");
    if (!circ) {
        throw 'Error';
    }
    const keydown$ = (0, rxjs_1.fromEvent)(document, "keydown");
    const moveLeft = keydown$.pipe((0, operators_1.filter)(e => e.key == 'a'));
    const moveRight = keydown$.pipe((0, operators_1.filter)(e => e.key == 'd'));
    const moveUp = keydown$.pipe((0, operators_1.filter)(e => e.key == 'w'));
    const moveDown = keydown$.pipe((0, operators_1.filter)(e => e.key == 's'));
    const inPlay = (n) => n < Number(svg.getAttribute("width")) - 50;
    const inPlay1 = (n) => n > 50;
    const coordinateDiff = (n) => (m) => f => f(n - m);
    moveLeft.pipe().subscribe(_ => {
        if (coordinateDiff(Number(svg.getAttribute("width")))(Number(circ.getAttribute("cx")))(inPlay)) {
            circ.setAttribute("cx", String(Number(circ.getAttribute("cx")) - 10));
        }
    });
    moveRight.pipe().subscribe(_ => {
        if (coordinateDiff(Number(svg.getAttribute("width")))(Number(circ.getAttribute("cx")))(inPlay1)) {
            circ.setAttribute("cx", String(Number(circ.getAttribute("cx")) + 10));
        }
    });
    moveUp.pipe().subscribe(_ => {
        if (coordinateDiff(Number(svg.getAttribute("width")))(Number(circ.getAttribute("cy")))(inPlay)) {
            circ.setAttribute("cy", String(Number(circ.getAttribute("cy")) - 10));
        }
    });
    moveDown.pipe().subscribe(_ => {
        if (coordinateDiff(Number(svg.getAttribute("width")))(Number(circ.getAttribute("cy")))(inPlay1)) {
            circ.setAttribute("cy", String(Number(circ.getAttribute("cy")) + 10));
        }
    });
}
// The following simply runs your main function on window load.  Make sure to leave it in place.
// if (typeof window !== "undefined") {
//   window.onload = () => {
//     main();
//   };
// }
document.addEventListener("DOMContentLoaded", () => { main(); });
//# sourceMappingURL=main.js.map