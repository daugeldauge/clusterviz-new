#pragma GCC diagnostic ignored "-Wwrite-strings"

#include <iostream>
#include <cstring>
#include <string>
#include <cstdio>
#include <exception>
#include <set>
#include <map>
#include <vector>
#include <fstream>
#include <sstream>

#include <graphviz/gvc.h>

using std::exception;
using std::string;
using std::set;
using std::cout;
using std::endl;
using std::map;
using std::vector;
using std::pair;
using std::make_pair;
using std::istringstream;

struct ConfigValue
{
    bool isNeeded;
    string color;
    ConfigValue(bool _isNeeded = false, string _color = string("")): isNeeded(_isNeeded), color(_color) {}
};

class Model
{
public:
    Model(): g(0) {}
    ~Model();

    void load(const char *filename);
    void loadConfig(const char *filename);
    void createLevels();
    void parseNodeParams();
    void handleEdges();
    void assignTypesToLabels();
    void delAllLabels();
    void delSingleNodes();
    void printLevels();
    void pickLevels(int from, int to);
    void pickLevelsFromRoot(char *name, int levelsnum);
    void deleteLevels(int levelsnum);
    void deleteLevelsFromRoot(char *name, int levelsnum);
    void colorizeEdges();
    void printNodeTypes();
    void printNodeParamsNames();
    void printEdgeTypes();
    void getNodeTypes(set<string> &types);
    void aggregateLeaves();
    void aggregate();
    void addNodeAttrs(const string &attrs);
    void addEdgeType(const string &type);
    void render(char *layout, char *render);

private:
    Agraph_t *g;
    vector<set<Agnode_t *>> levels;

    map<string, ConfigValue> edgeConfig;
    map<Agnode_t *, map<string, string>> nodeParams;
    set<string> nodeParamsNames;
    set<string> paramsToPrint;
    map<Agnode_t *, string> aggregatedLabels;
    // static char *edgeTypes[];
    // static bool isTypeNeeded[];
    // static char *colors[];
    
    void printOneNodeParams(string &out, Agnode_t *n);
    void merge(Agnode_t *n1, Agnode_t *n2, int minLevel);
    void assignAggregatedLabels();
    map<string, string> parseLabel(string label);
    void clearSingleLinksLabels();
    void deleteNode(Agnode_t *n, int minLevel);
    vector<Agedge_t *> getAllOutEdges(Agnode_t *n);
    set<Agnode_t *> getParents(Agnode_t *n);
    void assignCount(Agnode_t *n, int count);
    bool isEqual(Agnode_t *n1, Agnode_t *n2);
    void getRoots(set<Agnode_t *> &roots);
    void getLeaves(set<Agnode_t *> &leaves);
    static char *toCstr(const string &s) { return const_cast<char *>(s.c_str()); }
    static string getType(const string &label);
    static bool isOfType(Agedge_t *e, char *type);
    static bool isOfType(Agnode_t *n, const string &type) { return string(agget(n, "label")) == type;}
    void pickLevelsRecursively(Agnode_t *n, int levelsnum);
    void deleteLevelsRecursively(Agnode_t *n, int levelsnum);
};

// char *Model::edgeTypes[] =   { "contain",  "chill",    "power",    "ib",       "eth",      "serv_eth", "panasas_eth" };
// bool Model::isTypeNeeded[] = {  1,          0,          0,          0,          0,          0,          0            };
// char *Model::colors[] =      { "gray16",   "cyan",     "red",      "blue",     "gold",     "gold3",    "gold4"       };

// const map<string, ConfigValue> Model::edgeConfig = {
//     make_pair("contain",     ConfigValue(0, "gray16")),
//     make_pair("chill",       ConfigValue(0, "cyan"  )),
//     make_pair("power",       ConfigValue(0, "red"   )),
//     make_pair("ib",          ConfigValue(1, "blue"  )),
//     make_pair("eth",         ConfigValue(0, "gold"  )),
//     make_pair("serv_eth",    ConfigValue(0, "gold3" )),
//     make_pair("panasas_eth", ConfigValue(0, "gold4" )) 
// };

Model::~Model()
{
    if (g) {
        agclose(g); 
    }
}

map<string, string> Model::parseLabel(string label)
{
    map<string, string> params;
    size_t curPos = 0;
    for (;;) {
        string option, value;
        size_t from, to;
        
        from = label.find('\'', curPos);
        if (from == string::npos) {
            return params;
        }
        ++from;

        to = label.find('\'', from);
        if (to == string::npos) {
            return params;
        }

        option = label.substr(from , to - from);

        from = to + sizeof(" = ");
        to = label.find(' ', from);
        if (to == string::npos) {
            return params;
        }

        value = label.substr(from , to - from);
    
        params.insert(make_pair(option, value));
        nodeParamsNames.insert(option);
        
        curPos = to + 1;
    } 
}

string Model::getType(const string &s) 
{
    size_t from = s.find("'type' = '");
    if (from == string::npos) {
        return string("");
    }
    from += 10;
    size_t to = s.find_first_of('\'', from );
    if (to == string::npos) {
        return string("");
    }
    return s.substr(from, to - from);
}

void Model::parseNodeParams()
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        nodeParams.insert(make_pair(n, parseLabel(agget(n, "label"))));
    }
}

void Model::loadConfig(const char *filename)
{
    std::ifstream in;
    in.open(filename, std::ios::in);
    while (!in.eof()) {
        string edgeType;
        ConfigValue configValue;
        in >> edgeType >> configValue.isNeeded >> configValue.color;
        if (in.fail()) {
            throw string("Invalid configuration file");
        }
        edgeConfig.insert(make_pair(edgeType, configValue));
    }   
}

void Model::load(const char *filename)
{
    FILE *chebdot = fopen(filename, "r");
    if (!chebdot) {
        throw string("Unable to open `") + string(filename) + string("` for reading.");
    }
    g = agread(chebdot, 0);
    agattr(g, AGNODE, "xlabel", "");
    //agattr(g, AGNODE, "overlap", "prism=1000");
    //agattr(g, AGEDGE, "arrowhead", "empty");
    //paramsToPrint.insert("AID");
    //paramsToPrint.insert("ip");
    fclose(chebdot);

}

void Model::createLevels()
{
    levels.clear();
    int nodesLeft = 1;
    for (int i = 0; nodesLeft != 0; ++i) {
        levels.push_back(set<Agnode_t *>());
        nodesLeft = 0;
        for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
            
            if (agget(n, "xlabel") == string("*")) {
                continue;
            }
            
            bool toInclude = true;
            for (Agedge_t *e = agfstin(g, n); e; e = agnxtin(g, e)) {
                if (agget(agtail(e), "xlabel") != string("*") || levels[i].find(agtail(e)) != levels[i].end()) {
                    toInclude = false;
                }
            }            

            if (toInclude) {
                agset(n, "xlabel", "*");
                // cout << i << '\t' << agnameof(n) << endl; 
                levels[i].insert(n);
            } else {
                ++nodesLeft;
            }
        }
    }    
}

void Model::assignTypesToLabels()
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        agset(n, "label", toCstr(getType(agget(n, "label"))));
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            agset(e, "label", toCstr(getType(agget(e, "label"))));            
        }
    }
}

void Model::handleEdges()
{
    Agnode_t *n, *m;
    for (n = agfstnode(g); n; n = m) {
        m = agnxtnode(g, n);

        Agedge_t *e, *f;
        for (e = agfstout(g, n); e; e = f) {
            f = agnxtout(g, e);

            auto it = edgeConfig.find(agget(e, "label"));
            if (it == edgeConfig.end()) {
                cout << agget(e, "label");
                throw string("Unexpected edge type");
            }
            if (!it->second.isNeeded) {
                agdeledge(g, e);
            }
        }
    }   
}

void Model::delAllLabels()
{
    Agnode_t *n, *m;
    for (n = agfstnode(g); n; n = m) {
        m = agnxtnode(g, n);

        Agedge_t *e, *f;
        for (e = agfstout(g, n); e; e = f) {
            f = agnxtout(g, e);
            agset(e, "label", "");
        }

        //agset(n, "label", "");
        agset(n, "xlabel", "");
    }
}

void Model::delSingleNodes()
{
    Agnode_t *n, *m;
    for (n = agfstnode(g); n; n = m) {
        m = agnxtnode(g, n);
        if (!agfstout(g, n) && !agfstin(g, n)) {
            agdelnode(g, n);
        }
    }
}

void Model::pickLevelsRecursively(Agnode_t *root, int levelsnum)
{
    set<Agnode_t *> nextLevelNodes;

    for (Agedge_t *e = agfstout(g, root); e; e = agnxtout(g, e)) {
        if (isOfType(e, "contain")) {
            nextLevelNodes.insert(aghead(e));
        }
    }

    for (auto n = nextLevelNodes.begin(); n != nextLevelNodes.end(); ++n) {
        pickLevelsRecursively(*n, levelsnum - 1);
    }

    agset(root, "xlabel", "ok");
    if (levelsnum < 0) {
        agdelnode(g, root);
    }
}

void Model::getRoots(set<Agnode_t *> &roots)
{
    roots.clear();

    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        Agedge_t *e;
        for (e = agfstin(g, n); e; e = agnxtin(g, e)) {
            if (isOfType(e, "contain")) {
                break;
            }
        }
        if(!e) {
            roots.insert(n);
        }
    }

}

void Model::pickLevels(int from, int to)
{
    for (int i = static_cast<int>(levels.size()) - 1; i >= 0; --i) {
        if (i < from || i > to) {
            for (auto node = levels[i].begin(); node != levels[i].end(); ++node) {
                agdelnode(g, *node);
            }
            levels.erase(levels.begin() + i);
        }
    }
}


void Model::colorizeEdges()
{
    agattr(g, AGEDGE, "color", "black");
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            auto it = edgeConfig.find(agget(e, "label"));
            if (it == edgeConfig.end()) {
                throw string("Unexpected edge type");
            }
            agset(e, "color", toCstr(it->second.color));
        }
    }
} 

void Model::render(char *layout, char *filename)
{
    GVC_t *gvc = gvContext();
    gvLayout(gvc, g, layout);
    gvRenderFilename(gvc, g, "svg", filename);
    gvFreeLayout(gvc, g);
    gvFreeContext(gvc);
//  not necessary
    FILE *out = fopen((string(filename) + ".dot").c_str(), "w");
    agwrite(g, out);
    fclose(out);
}

inline bool Model::isOfType(Agedge_t *e, char *type)
{ 
    char *label = agget(e, "label");
    if (!label) {
        return false;
    }
    return (strcmp(label, type) == 0);
}

void Model::printEdgeTypes()
{
    set<string> types;
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            types.insert(getType(agget(e, "label")));
        }
    }

    for (auto it = types.begin(); it != types.end(); ++it) {
        cout << *it << " ";
    }
    cout << endl;
}

void Model::getNodeTypes(set<string> &types)
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        types.insert(getType(agget(n, "label")));
    }
}

void Model::printNodeTypes()
{
    set<string> types;
    getNodeTypes(types);

    for (auto it = types.begin(); it != types.end(); ++it) {
        cout << *it << endl;
    }
}

void Model::printNodeParamsNames()
{
    for (auto it = nodeParamsNames.begin(); it != nodeParamsNames.end(); ++it) {
        cout << *it << ' ';
    }
}

void Model::aggregateLeaves()
{
    set<string> types;

    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        types.insert(agget(n, "label"));
    }

    set<Agnode_t *> roots;
    getRoots(roots);

    for (auto root = roots.begin(); root != roots.end(); ++root) {
        for (auto type = types.begin(); type != types.end(); ++type) {
            int n = 0;
            for (Agedge_t *e = agfstout(g, *root); e; e = agnxtout(g, e)) {
                if (isOfType(aghead(e), *type)) {
                    ++n;
                }
            }
            Agedge_t *e = agfstout(g, *root), *f;
            for (int i = 1; i < n; e = f) {
                f = agnxtout(g, e);
                if (isOfType(aghead(e), *type)) {
                    ++i;
                    agdelnode(g, aghead(e));
                }
            }
            for (Agedge_t *e = agfstout(g, *root); e; e = agnxtout(g, e)) {
                if (isOfType(aghead(e), *type)) {
                    agset(e, "label", toCstr(std::to_string((long long)n)));
                }
            }
        }
    }
}

void Model::getLeaves(set<Agnode_t *> &leaves)
{
    leaves.clear();
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        if (agfstout(g, n) == 0) {
            leaves.insert(n);
        }
    }
}

vector<Agedge_t *> Model::getAllOutEdges(Agnode_t *n)
{
    vector<Agedge_t *> edges;
    for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
        edges.push_back(e);
    }
    return edges;
}

set<Agnode_t *> Model::getParents(Agnode_t *n) 
{
    set<Agnode_t *> parents;
    for (Agedge_t *e = agfstin(g, n); e; e = agnxtin(g, e)) {
        parents.insert(agtail(e));
    }
    return parents;
}

//equal but not identical
bool Model::isEqual(Agnode_t *n1, Agnode_t *n2)
{
    if (n1 == n2) {
        return false;
    }
    if (strcmp(agget(n1, "label"), agget(n2, "label"))) {
        return false;
    }

    set<Agnode_t *> n1Parents, n2Parents;
    n1Parents = getParents(n1);
    n2Parents = getParents(n2);
    
    if (n1Parents.size() != n2Parents.size()) {
        return false;
    }

    for (auto u = n1Parents.begin(); u != n1Parents.end(); ++u) {
        bool isFinded = false;
        for (auto v = n2Parents.begin(); v != n2Parents.end(); ++v) {
            if (strcmp(agget(*u, "label"), agget(*v, "label")) == 0) {
                isFinded = true;
                n2Parents.erase(*v);
                break;
            }
        }
        if (!isFinded) {
            return false;
        }
    }


    vector<Agedge_t *> n1Edges, n2Edges;
    n1Edges = getAllOutEdges(n1);
    n2Edges = getAllOutEdges(n2);

    if (n1Edges.size() != n2Edges.size()) {
        return false;
    }

    for (auto u = n1Edges.begin(); u != n1Edges.end(); ++u) {
        bool isFinded = false;
        for (auto v = n2Edges.begin(); v != n2Edges.end(); ++v) {
            if (strcmp(agget(*u, "label"), agget(*v, "label"))) {
                continue;
            }
            if (isEqual(aghead(*u), aghead(*v))) {
                isFinded = true;
                break;
            }
        }
        if (!isFinded) {
            return false;
        }
    }
    return true;
}

void Model::deleteNode(Agnode_t *n, int minLevel)
{
    // Agedge_t *e, *f;
    // for (e = agfstout(g, n); e; e = f) {
    //     f = agnxtout(g, e);
    //     deleteNode(aghead(e), minLevel + 1);
    // }

    int i = minLevel;
    set<Agnode_t *>::iterator it;
    do {
        if (i >= int(levels.size())) {
            throw string("Needed node hasn't been found in levels");
        }
        it = levels[i].find(n);
    } while (it == levels[i++].end());
    
    levels[i - 1].erase(n);

    aggregatedLabels.erase(n);

    agdelnode(g, n);

}

void Model::assignCount(Agnode_t *n, int count)
{
    for (Agedge_t *e = agfstin(g, n); e; e = agnxtin(g, e)) {
        agset(e, "label", toCstr(std::to_string((long long)count)));
    }
}
void Model::clearSingleLinksLabels()
{
    for (Agnode_t *n = agfstnode(g); n; n = agnxtnode(g, n)) {
        for (Agedge_t *e = agfstout(g, n); e; e = agnxtout(g, e)) {
            if (agget(e, "label") == string("1")) {
                agset(e, "label", ""); 
            }            
        }
    }
}

void Model::printOneNodeParams(string &out, Agnode_t *n)
{
    map<string, string> params = nodeParams[n];
    out += "|";
    for (auto param = params.begin(); param != params.end(); ++param) {
        if (paramsToPrint.find(param->first) != paramsToPrint.end()) {
            out += param->first + ": " + param->second +"\\n";
        }
    }
    size_t back = out.size() - 1;
    if (out[back] == '|') {
        out.erase(back, 1);
    }
}

void Model::merge(Agnode_t *n1, Agnode_t *n2, int minLevel)
{
    //cout << "begin ";
    vector<Agedge_t *> n1Edges, n2Edges;
    n1Edges = getAllOutEdges(n1);
    n2Edges = getAllOutEdges(n2);

    for (auto u = n1Edges.begin(); u != n1Edges.end(); ++u) {
        for (auto v = n2Edges.begin(); v != n2Edges.end(); ++v) {
            if (!(*v) || strcmp(agget(*u, "label"), agget(*v, "label"))) {
                continue;
            }
            if (isEqual(aghead(*u), aghead(*v))) {
                merge(aghead(*u), aghead(*v), minLevel + 1);
                *v = 0;
                //cout << "never land \n";
                //assignCount(aghead(*u),  2 * atoi(agget(*u, "label")));
                break;
            }
        }
    }
    //cout << "middle ";
    auto n1Label = aggregatedLabels.find(n1);
    auto n2Label = aggregatedLabels.find(n2);
    if (n2Label != aggregatedLabels.end()) {
        n1Label->second += n2Label->second;
    } else {
        printOneNodeParams(n1Label->second, n2);
    }
    // agdelnode(g, n2);
    deleteNode(n2, minLevel);
    //cout << "end" << endl;
}

void Model::assignAggregatedLabels()
{
    for (auto p = aggregatedLabels.begin(); p != aggregatedLabels.end(); ++p) {
        string label = string("{") + agget(p->first, "label") + p->second + "}";
        agset(p->first, "label", toCstr(label));
    }
}

void Model::aggregate()
{
    for (int i = levels.size() - 2; i >= 0; --i) {
        for (auto node = levels[i].begin(); node != levels[i].end(); ++node) {
            for (Agedge_t *e = agfstout(g, *node); e; e = agnxtout(g, e)) {
                int linkCount;
                if (sscanf(agget(e, "label"), "%d", &linkCount) > 0) {
                    continue;
                }
                linkCount = 1;
                
                string &label = aggregatedLabels.insert(make_pair(aghead(e), string())).first->second;

                //label += string("{") + agget(aghead(e), "label");
                printOneNodeParams(label, aghead(e));

                Agedge_t *u, *v;
                for (u = agfstout(g, *node); u; u = v) {
                    v = agnxtout(g, u);
                    Agnode_t *head = aghead(u);

                    if (isEqual(head, aghead(e))) {
                        ++linkCount;
                        merge(aghead(e), head, i);
                        //printOneNodeParams(label, head);
                        //deleteNode(head, i);
                    }
                }

                assignCount(aghead(e), linkCount);
                //agset(e, "label", toCstr(std::to_string((long long)linkCount)));

                e = agfstout(g, *node);
            }
        }
    }
    for (auto node = levels[0].begin(); node != levels[0].end(); ++node) {
        string &label = aggregatedLabels.insert(make_pair(*node, string())).first->second;
        printOneNodeParams(label, *node);
    }
    assignAggregatedLabels();
    clearSingleLinksLabels();

}


void Model::printLevels()
{
    for (unsigned int i = 0; i < levels.size(); ++i) {
        cout << "level " << i << ":" << endl;
        for (auto node = levels[i].begin(); node != levels[i].end(); ++node) {
            cout  << "\t" << agnameof(*node) << "\t" << agget(*node, "label") << endl; 
        }
        cout << endl;
    }
}

void Model::addEdgeType(const string &type) {
    edgeConfig[type].isNeeded = true;
}

void Model::addNodeAttrs(const string &attrs) {
    istringstream iss(attrs);
    while (!iss.eof()) {
        string s;
        iss >> s;
        cout << s << endl;
        paramsToPrint.insert(s);
    } 
}

class CommandLineOptions {
    int argc;
    char **argv;
public:
    CommandLineOptions(int c, char **v): argc(c), argv(v) {}
    bool getOption(const string &opt, string &value) {
        for (int i = 0; i < argc; ++i) {
            string arg = argv[i];
            size_t len = opt.length();
            if (arg.compare(0, len, opt) == 0) {
                // cout << opt;
                if (arg[len] == '=') {
                    value =  arg.substr(len + 1);
                    // cout << " = " << value;
                }
                // cout << endl;
                return true;
            }
        }
        return false;
    }
};

int main(int argc, char *argv[])
{
    try {
        CommandLineOptions opts(argc, argv);

        Model m;
        m.load(argv[1]);

        string val;
        if (opts.getOption("--print-edge-types", val)) {
            m.printEdgeTypes();
            return 0;
        }
        
        m.loadConfig("config.txt");
        
        if (opts.getOption("--edge-type", val)) {
            m.addEdgeType(val);
        }
        if (opts.getOption("--node-attrs", val)) {
            m.addNodeAttrs(val);
        }


        m.parseNodeParams();
        //m.printNodeParamsNames();

        m.assignTypesToLabels();
        m.handleEdges();
        m.createLevels();
        m.colorizeEdges();
        m.delAllLabels();

        int from = atoi(argv[2]);
        int to = atoi(argv[3]);
        if (from != -1 && to != -1) {
            m.pickLevels(from, to);
        }

        if (opts.getOption("--aggregate", val)) {
            m.aggregate();
        }
        if (opts.getOption("--remove-single-nodes", val)) {
            m.delSingleNodes();
        }

        m.render(argv[4], argv[5]);
    } catch (const string &s) {
        std::cout << "Error: " << s << std::endl; 
        return 1;
    }
    return 0;
}