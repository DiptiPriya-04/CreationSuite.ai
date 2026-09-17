import React from 'react';

const Gauge = ({ value, theme }) => {
    const percentage = Math.min(Math.max(value, 0), 100);
    const bgColor = 
        percentage < 50 ? 'bg-gradient-to-r from-red-600 to-red-500' :
        percentage < 75 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
        'bg-gradient-to-r from-emerald-500 to-green-400';

    return (
        <div className={`relative w-full h-5 ${
                theme === 'dark' ? 'bg-zinc-700/70 border border-zinc-600' : 'bg-gray-200 border border-gray-300'
            } rounded-full overflow-hidden`}>
            <div 
                className={`absolute top-0 left-0 h-full ${bgColor} rounded-full transition-all duration-700 ease-out`}
                style={{ width: `${percentage}%` }}
            ></div>
            <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                <span className='text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'>
                    {percentage}%
                </span>
            </div>
        </div>
    );
};

export default Gauge;