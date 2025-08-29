import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const markdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    return !inline && match ? (
      React.createElement(SyntaxHighlighter, {
        style: oneDark,
        language: language,
        PreTag: "div",
        ...props
      }, String(children).replace(/\n$/, ''))
    ) : (
      React.createElement('code', {
        className: className,
        ...props
      }, children)
    );
  }
};