import React from 'react';
import Gauge from './Gauge'; 

const ATSResult = ({ data, theme }) => {
    if (!data || typeof data !== 'object') {
        return (
            <div className={`text-red-500 p-4 ${
                theme === 'dark' ? 'bg-zinc-900' : 'bg-red-50'
            } rounded-lg`}>
                Invalid results data. Please try again.
            </div>
        );
    }

    // Extract breakdown components
    const rawBreakdown = data.breakdown && typeof data.breakdown === 'object' ? data.breakdown : {};
    
    // Determine skills source
    const skillsMap = rawBreakdown.skills && typeof rawBreakdown.skills === 'object' 
        ? rawBreakdown.skills 
        : Object.fromEntries(
            Object.entries(rawBreakdown).filter(([key]) => key !== 'keywords' && key !== 'experience')
        );

    const keywords = rawBreakdown.keywords && typeof rawBreakdown.keywords === 'object' ? rawBreakdown.keywords : null;
    const experience = rawBreakdown.experience && typeof rawBreakdown.experience === 'object' ? rawBreakdown.experience : null;

    return (
        <div className='mt-3 space-y-6 overflow-y-auto'>
            {/* Overall Score */}
            {'score' in data && (
                <div className={`p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-zinc-800/80 border border-zinc-700' : 'bg-gray-100 border border-gray-200'
                }`}>
                    <div className='flex justify-between items-center mb-4'>
                        <div>
                            <h3 className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Overall ATS Score</h3>
                            <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
                                Match percentage against job description
                            </p>
                        </div>
                        <span className={`text-2xl font-bold ${
                            Number(data.score) >= 70 ? 'text-green-500' : Number(data.score) >= 50 ? 'text-yellow-500' : 'text-red-500'
                        }`}>{data.score}/100</span>
                    </div>
                    <Gauge value={Number(data.score) || 0} theme={theme} />

                    {/* Quick Stat Badges */}
                    {(keywords || experience) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-700/50">
                            {keywords && (
                                <div className={`p-3 rounded-lg text-xs ${
                                    theme === 'dark' ? 'bg-zinc-900/60' : 'bg-white'
                                }`}>
                                    <span className="font-medium text-zinc-400">Keywords Match:</span>
                                    <span className={`ml-2 font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        {keywords.matched ?? keywords.matches ?? 0} / {keywords.total ?? keywords.count ?? 0}
                                    </span>
                                </div>
                            )}
                            {experience && (
                                <div className={`p-3 rounded-lg text-xs ${
                                    theme === 'dark' ? 'bg-zinc-900/60' : 'bg-white'
                                }`}>
                                    <span className="font-medium text-zinc-400">Experience Alignment:</span>
                                    <span className={`ml-2 font-bold ${
                                        experience.match ? 'text-green-400' : 'text-yellow-400'
                                    }`}>
                                        {experience.match ? 'Matched' : 'Needs Tailoring'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Skills Analysis */}
            {Object.keys(skillsMap).length > 0 && (
                <div className={`p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-zinc-800/80 border border-zinc-700' : 'bg-gray-100 border border-gray-200'
                }`}>
                    <h3 className={`font-semibold mb-3 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Skills Analysis</h3>
                    <div className='space-y-3'>
                        {Object.entries(skillsMap).map(([skill, details]) => {
                            const isDetailed = typeof details === 'object' && details !== null;
                            const matchStatus = isDetailed ? Boolean(details.match) : Boolean(details);
                            const feedback = isDetailed ? details.feedback : '';
                            const importance = isDetailed ? details.importance : null;

                            return (
                                <div key={skill} className={`p-3 rounded-lg ${
                                    theme === 'dark' ? 'bg-zinc-900/90 border border-zinc-700/60' : 'bg-white border border-gray-200'
                                }`}>
                                    <div className='flex justify-between items-center gap-2'>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium capitalize ${
                                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            }`}>{skill.replace(/_/g, ' ')}</span>
                                            {importance && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                                                    importance.toLowerCase() === 'high' 
                                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                                                        : 'bg-zinc-700 text-zinc-300'
                                                }`}>
                                                    {importance}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            matchStatus 
                                                ? theme === 'dark' 
                                                    ? 'bg-green-900/40 text-green-400 border border-green-700/50' 
                                                    : 'bg-green-100 text-green-800'
                                                : theme === 'dark'
                                                    ? 'bg-red-900/40 text-red-400 border border-red-700/50' 
                                                    : 'bg-red-100 text-red-800'
                                        }`}>
                                            {matchStatus ? 'MATCH' : 'MISSING'}
                                        </span>
                                    </div>
                                    {feedback && (
                                        <p className={`text-xs mt-1.5 leading-relaxed ${
                                            theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                                        }`}>{feedback}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Overall Feedback */}
            {data.feedback && (
                <div className={`p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-zinc-800/80 border border-zinc-700' : 'bg-gray-100 border border-gray-200'
                }`}>
                    <h3 className={`font-semibold mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Summary Feedback</h3>
                    <p className={`text-sm leading-relaxed ${
                        theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                    }`}>{data.feedback}</p>
                </div>
            )}

            {/* Suggestions */}
            {data.suggestions && (
                <div className={`p-4 rounded-xl ${
                    theme === 'dark' ? 'bg-zinc-800/80 border border-zinc-700' : 'bg-gray-100 border border-gray-200'
                }`}>
                    <h3 className={`font-semibold mb-3 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Improvement Suggestions</h3>
                    <ul className='space-y-2'>
                        {(Array.isArray(data.suggestions) ? data.suggestions : [data.suggestions]).filter(Boolean).map((suggestion, index) => (
                            <li key={index} className={`text-xs p-2.5 rounded-lg flex items-start gap-2 ${
                                theme === 'dark' ? 'bg-zinc-900/60 text-zinc-300' : 'bg-white text-gray-700 border border-gray-200'
                            }`}>
                                <span className="text-blue-500 font-bold">•</span>
                                <span className="leading-relaxed">{suggestion}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ATSResult;