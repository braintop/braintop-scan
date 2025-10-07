import { Routes, Route } from 'react-router-dom';
import Layout from '../Layout';
import About from '../About/About';
import Login from '../Login/Login';
import Register from '../Register/Register';
import Home from '../Home/Home';
import Profile from '../Profile/Profile';
import { Min5Dashboard } from '../../Sidebar/Min5';

// Hourly components
import HourAScan from '../../Sidebar/Hour/HourAScan';
import HourACreateData from '../../Sidebar/Hour/HourACreateData';
import HourBSpy from '../../Sidebar/Hour/HourBSpy';
import HourCAtrPrice from '../../Sidebar/Hour/HourCAtrPrice';
import HourDSignals from '../../Sidebar/Hour/HourDSignals';
import HourEAdx from '../../Sidebar/Hour/HourEAdx';

// Daily components
import AScanDaily from '../../Sidebar/Day/Components/AScan';
import ZDeleteListDaily from '../../Sidebar/Day/Components/ZDeleteList';
import ACreateDataDaily from '../../Sidebar/Day/Components/ACreateData';
import BSpyDaily from '../../Sidebar/Day/Components/BSpy';
import CAtrPriceDaily from '../../Sidebar/Day/Components/CAtrPrice';
import DSignalsDaily from '../../Sidebar/Day/Components/DSignals';
import EAdxDaily from '../../Sidebar/Day/Components/EAdx';
import MasterAnalysisDaily from '../../Sidebar/Day/Components/MasterAnalysis';
import { RR1 } from '../../Sidebar/Day/Components/RR1';
import TradingJournal from '../../Sidebar/Day/Components/TradingJournal';
import TradingJournalAfter from '../../Sidebar/Day/Components/TradingJournalAfter';
import TradingJournalFinal from '../../Sidebar/Day/Components/TradingJournalFinal';

// Weekly components
import WeekAScan from '../../Sidebar/Week/WeekAScan';
import WeekACreateData from '../../Sidebar/Week/WeekACreateData';
import WeekBSpy from '../../Sidebar/Week/WeekBSpy';
import WeekCAtrPrice from '../../Sidebar/Week/WeekCAtrPrice';
import WeekDSignals from '../../Sidebar/Week/WeekDSignals';
import WeekEAdx from '../../Sidebar/Week/WeekEAdx';
import WeekMasterAnalysis from '../../Sidebar/Week/WeekMasterAnalysis';

// Monthly components
import MonthAScan from '../../Sidebar/Month/MonthAScan';
import MonthACreateData from '../../Sidebar/Month/MonthACreateData';
import MonthBSpy from '../../Sidebar/Month/MonthBSpy';
import MonthCAtrPrice from '../../Sidebar/Month/MonthCAtrPrice';
import MonthDSignals from '../../Sidebar/Month/MonthDSignals';
import MonthEAdx from '../../Sidebar/Month/MonthEAdx';

// Short components
import ShortHourBSpy from '../../SidebarShort/Hour/ShorthHourBSpy';
import ShortHourCAtrPrice from '../../SidebarShort/Hour/ShorthHourCAtrPrice';
import ShortHourDSignals from '../../SidebarShort/Hour/ShorthHourDSignals';
import ShortHourEAdx from '../../SidebarShort/Hour/ShorthHourEAdx';

import ShortDailyBSpy from '../../SidebarShort/Day/Components/ShorthBSpy';
import ShortDailyCAtrPrice from '../../SidebarShort/Day/Components/ShorthCAtrPrice';
import ShortDailyDSignals from '../../SidebarShort/Day/Components/ShorthDSignals';
import ShortDailyEAdx from '../../SidebarShort/Day/Components/ShorthEAdx';
import ShortDailyMasterAnalysis from '../../SidebarShort/Day/Components/ShorthMasterAnalysis';

import ShortWeekAScan from '../../SidebarShort/Week/ShortWeekAScan';
import ShortWeekACreateData from '../../SidebarShort/Week/ShortWeekACreateData';
import ShortWeekBSpy from '../../SidebarShort/Week/ShortWeekBSpy';
import ShortWeekCAtrPrice from '../../SidebarShort/Week/ShortWeekCAtrPrice';
import ShortWeekDSignals from '../../SidebarShort/Week/ShortWeekDSignals';
import ShortWeekEAdx from '../../SidebarShort/Week/ShortWeekEAdx';

import ShortMonthAScan from '../../SidebarShort/Month/ShortMonthAScan';
import ShortMonthACreateData from '../../SidebarShort/Month/ShortMonthACreateData';
import ShortMonthBSpy from '../../SidebarShort/Month/ShortMonthBSpy';
import ShortMonthCAtrPrice from '../../SidebarShort/Month/ShortMonthCAtrPrice';
import ShortMonthDSignals from '../../SidebarShort/Month/ShortMonthDSignals';
import ShortMonthEAdx from '../../SidebarShort/Month/ShortMonthEAdx';

export default function Routing() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="home" element={<Home />} />
                <Route path="about" element={<About />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="profile" element={<Profile />} />
                
                {/* Min5 Route */}
                <Route path="min5" element={<Min5Dashboard />} />
                
                {/* Hourly Routes */}
                <Route path="hourly" element={<HourAScan />} />
                <Route path="hourly/ascan" element={<HourAScan />} />
                <Route path="hourly/acreatedata" element={<HourACreateData />} />
                <Route path="hourly/bspy" element={<HourBSpy />} />
                <Route path="hourly/catrprice" element={<HourCAtrPrice />} />
                <Route path="hourly/dsignals" element={<HourDSignals />} />
                <Route path="hourly/eadx" element={<HourEAdx />} />
                
                {/* Daily Routes */}
                <Route path="daily" element={<AScanDaily />} />
                <Route path="daily/ascan" element={<AScanDaily />} />
                <Route path="daily/deletelist" element={<ZDeleteListDaily />} />
                <Route path="daily/acreatedata" element={<ACreateDataDaily />} />
                <Route path="daily/bspy" element={<BSpyDaily />} />
                <Route path="daily/catrprice" element={<CAtrPriceDaily />} />
                <Route path="daily/dsignals" element={<DSignalsDaily />} />
                <Route path="daily/eadx" element={<EAdxDaily />} />
                <Route path="daily/master" element={<MasterAnalysisDaily />} />
                <Route path="daily/rr1" element={<RR1 />} />
                <Route path="daily/trading-journal" element={<TradingJournal />} />
                <Route path="daily/after-trading-journal" element={<TradingJournalAfter />} />
                <Route path="daily/final-trading-journal" element={<TradingJournalFinal />} />
                
                {/* Weekly Routes */}
                <Route path="weekly" element={<WeekAScan />} />
                <Route path="weekly/ascan" element={<WeekAScan />} />
                <Route path="weekly/acreatedata" element={<WeekACreateData />} />
                <Route path="weekly/bspy" element={<WeekBSpy />} />
                <Route path="weekly/catrprice" element={<WeekCAtrPrice />} />
                <Route path="weekly/dsignals" element={<WeekDSignals />} />
                <Route path="weekly/eadx" element={<WeekEAdx />} />
                <Route path="weekly/master" element={<WeekMasterAnalysis />} />
                
                {/* Monthly Routes */}
                <Route path="monthly" element={<MonthAScan />} />
                <Route path="monthly/ascan" element={<MonthAScan />} />
                <Route path="monthly/acreatedata" element={<MonthACreateData />} />
                <Route path="monthly/bspy" element={<MonthBSpy />} />
                <Route path="monthly/catrprice" element={<MonthCAtrPrice />} />
                <Route path="monthly/dsignals" element={<MonthDSignals />} />
                <Route path="monthly/eadx" element={<MonthEAdx />} />
                
                {/* Short Hourly Routes */}
                <Route path="short/hourly" element={<ShortHourBSpy />} />
                <Route path="short/hourly/bspy" element={<ShortHourBSpy />} />
                <Route path="short/hourly/catrprice" element={<ShortHourCAtrPrice />} />
                <Route path="short/hourly/dsignals" element={<ShortHourDSignals />} />
                <Route path="short/hourly/eadx" element={<ShortHourEAdx />} />
                
                {/* Short Daily Routes */}
                <Route path="short/daily" element={<ShortDailyBSpy />} />
                <Route path="short/daily/bspy" element={<ShortDailyBSpy />} />
                <Route path="short/daily/catrprice" element={<ShortDailyCAtrPrice />} />
                <Route path="short/daily/dsignals" element={<ShortDailyDSignals />} />
                <Route path="short/daily/eadx" element={<ShortDailyEAdx />} />
                <Route path="short/daily/master" element={<ShortDailyMasterAnalysis />} />
                
                {/* Short Weekly Routes */}
                <Route path="short/weekly" element={<ShortWeekAScan />} />
                <Route path="short/weekly/ascan" element={<ShortWeekAScan />} />
                <Route path="short/weekly/acreatedata" element={<ShortWeekACreateData />} />
                <Route path="short/weekly/bspy" element={<ShortWeekBSpy />} />
                <Route path="short/weekly/catrprice" element={<ShortWeekCAtrPrice />} />
                <Route path="short/weekly/dsignals" element={<ShortWeekDSignals />} />
                <Route path="short/weekly/eadx" element={<ShortWeekEAdx />} />
                
                {/* Short Monthly Routes */}
                <Route path="short/monthly" element={<ShortMonthAScan />} />
                <Route path="short/monthly/ascan" element={<ShortMonthAScan />} />
                <Route path="short/monthly/acreatedata" element={<ShortMonthACreateData />} />
                <Route path="short/monthly/bspy" element={<ShortMonthBSpy />} />
                <Route path="short/monthly/catrprice" element={<ShortMonthCAtrPrice />} />
                <Route path="short/monthly/dsignals" element={<ShortMonthDSignals />} />
                <Route path="short/monthly/eadx" element={<ShortMonthEAdx />} />
            </Route>
        </Routes>
    );
}