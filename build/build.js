import camelize from 'camelcase';
import {basename, resolve} from 'path';
import {args, compile, glob, icons} from './util.js';

const bundles = getBundleTasks();
const components = await getComponentTasks();
const buildAll = args.all || Object.keys(args).filter(name =>
    ['d', 'debug', 'nominify', 'watch'].includes(name)
).length <= 1;

if (args.h || args.help) {
    console.log(`
        usage:

        build.js [componentA, componentB, ...] [-d|debug|nominify|watch]

        examples:

        build.js // builds all of uikit, including icons and does minification (implies 'all')
        build.js uikit icons -d // builds all of uikit and the icons, skipping the minification
        build.js core lightbox -d // builds uikit-core and the lightbox, skipping the minification

        available components:

        bundles: ${Object.keys(bundles).join(', ')}
        components: ${Object.keys(components).join(', ')}

    `);
    process.exit(0);
}

let tasks;
const allTasks = {...bundles, ...components};
if (buildAll) {
    tasks = allTasks;
} else if (args.components) {
    tasks = components;
} else {
    tasks = Object.keys(args)
        .map(step => allTasks[step])
        .filter(t => t);
}

await Promise.all(Object.values(tasks).map(task => task()));

function getBundleTasks() {
    return {

        core: () => compile('src/js/uikit-core.js', 'dist/js/uikit-core'),

        uikit: () => compile('src/js/uikit.js', 'dist/js/uikit'),

        icons: async () => compile('build/wrapper/icons.js', 'dist/js/uikit-icons', {
            name: 'icons',
            replaces: {ICONS: await icons('{src/images,custom}/icons/*.svg')}
        }),

        tests: async () => compile('tests/js/index.js', 'tests/js/test', {
            name: 'test',
            replaces: {TESTS: await getTestFiles()}
        })

    };
}

async function getComponentTasks() {

    const components = await glob('src/js/components/!(index).js');

    return components.reduce((components, file) => {

        const name = basename(file, '.js');

        components[name] = () =>
            compile('build/wrapper/component.js', `dist/js/components/${name}`, {
                name,
                external: ['uikit', 'uikit-util'],
                globals: {uikit: 'UIkit', 'uikit-util': 'UIkit.util'},
                aliases: {component: resolve('src/js/components', name)},
                replaces: {NAME: `'${camelize(name)}'`}
            });

        return components;

    }, {});
}

async function getTestFiles() {
    const files = await glob('tests/!(index).html', {nosort: true});
    return JSON.stringify(files.map(file => basename(file, '.html')));
}
