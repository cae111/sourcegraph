import {
    basicSyntaxColumns,
    exampleQueryColumns,
} from '@sourcegraph/web/src/search/home/QueryExamplesHomepage.constants'

export function getQueryExamples(): { title: string; columns: typeof basicSyntaxColumns }[] {
    return [
        {
            title: 'Code search basics',
            columns: basicSyntaxColumns,
        },
        {
            title: 'Search query examples',
            columns: exampleQueryColumns,
        },
    ]
}
